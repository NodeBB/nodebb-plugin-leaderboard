
'use strict';

const cron = require.main.require('cron').CronJob;
const nconf = require.main.require('nconf');

const db = require.main.require('./src/database');
const privileges = require.main.require('./src/privileges');
const helpers = require.main.require('./src/routes/helpers');
const controllersHelpers = require.main.require('./src/controllers/helpers');
const usersController = require.main.require('./src/controllers/users');
const pubsub = require.main.require('./src/pubsub');

const plugin = module.exports;

const cronJobs = [];

cronJobs.push(new cron('0 0 17 * * *', function() {db.delete('users:reputation:daily');}, null, false));
cronJobs.push(new cron('0 0 17 * * 0', function() {db.delete('users:reputation:weekly');}, null, false));
cronJobs.push(new cron('0 0 17 1 * *', function() {db.delete('users:reputation:monthly');}, null, false));

plugin.init = function(params, callback) {
	helpers.setupPageRoute(params.router, '/leaderboard/:term?', params.middleware, [], plugin.renderLeaderboard);
	reStartCronJobs();
	callback();
};

plugin.renderLeaderboard = async function(req, res) {
	const canView = await privileges.global.can('view:users', req.uid);
	if (!canView) {
		controllersHelpers.notAllowed(req, res);
		return;
	}

	let term = req.params.term || '';
	if (term === 'alltime') {
		term = '';
	}
	const set = 'users:reputation' + (term ? ':' + term : '');

	const userData = await usersController.getUsers(set, req.uid, req.query);
	const uids = userData.users.map(user => user && user.uid);
	const scores = await db.sortedSetScores(set, uids);
	userData.users.forEach(function(user, index) {
		if (user) {
			user.reputation = scores[index] || 0;
		}
	});
	const breadcrumbs = [{
		text: term ? (term.charAt(0).toUpperCase() + term.slice(1)) : 'Leaderboard'
	}];

	if (term) {
		breadcrumbs.unshift({text: 'Leaderboard', url: '/leaderboard'});
		userData[term] = true;
	}

	userData.breadcrumbs = controllersHelpers.buildBreadcrumbs(breadcrumbs);
	userData['section_sort-reputation'] = true;
	userData.title = 'Leaderboard';
	res.render('leaderboard', userData);
};

plugin.getNavigation = async function(core) {
	core.push({
		route: '/leaderboard',
		title: 'Leaderboard',
		enabled: false,
		iconClass: 'fa-star',
		textClass: 'visible-xs-inline',
		text: 'Leaderboard',
		properties: {  },
		core: false
	});
	return core;
};

plugin.onUpvote = function(data) {
	var change = 0;
	if (data.current === 'unvote') {
		change = 1;
	} else if (data.current === 'downvote') {
		change = 2;
	}

	updateLeaderboards(change, data.owner);
};

plugin.onDownvote = function(data) {
	var change = 0;
	if (data.current === 'unvote') {
		change = -1;
	} else if (data.current === 'upvote') {
		change = -2;
	}
	updateLeaderboards(change, data.owner);
};

plugin.onUnvote = function(data) {
	var change = 0;
	if (data.current === 'upvote') {
		change = -1;
	} else if (data.current === 'downvote') {
		change = 1;
	}
	updateLeaderboards(change, data.owner);
};

function updateLeaderboards(change, owner) {
	if (change) {
		db.sortedSetIncrBy('users:reputation:daily', change, owner);
		db.sortedSetIncrBy('users:reputation:weekly', change, owner);
		db.sortedSetIncrBy('users:reputation:monthly', change, owner);
	}
}

plugin.deactivate = function(data) {
	if (data.id === 'nodebb-plugin-leaderboard') {
		pubsub.publish('nodebb-plugin-leaderboard:deactivate');
	}
};

pubsub.on('nodebb-plugin-leaderboard:deactivate', function() {
	stopCronJobs();
});

function reStartCronJobs() {
	if (nconf.get('isPrimary')) {
		stopCronJobs();
		cronJobs.forEach(function(job) {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('isPrimary')) {
		cronJobs.forEach(function(job) {
			job.stop();
		});
	}
}
