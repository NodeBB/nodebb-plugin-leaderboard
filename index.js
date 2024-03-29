'use strict';

const cron = require.main.require('cron').CronJob;
const nconf = require.main.require('nconf');

const controllersHelpers = require.main.require('./src/controllers/helpers');
const usersController = require.main.require('./src/controllers/users');
const db = require.main.require('./src/database');
const privileges = require.main.require('./src/privileges');
const pubsub = require.main.require('./src/pubsub');
const helpers = require.main.require('./src/routes/helpers');


const cronJobs = [];
cronJobs.push(new cron('0 0 17 * * *', (() => { db.delete('users:reputation:daily'); }), null, false));
cronJobs.push(new cron('0 0 17 * * 0', (() => { db.delete('users:reputation:weekly'); }), null, false));
cronJobs.push(new cron('0 0 17 1 * *', (() => { db.delete('users:reputation:monthly'); }), null, false));


const LeaderboardPlugin = {};

LeaderboardPlugin.init = async function (params) {
	helpers.setupPageRoute(params.router, '/leaderboard/:term?', params.middleware, [], LeaderboardPlugin.renderLeaderboard);
	reStartCronJobs();
};

LeaderboardPlugin.renderLeaderboard = async function (req, res) {
	const canView = await privileges.global.can('view:users', req.uid);
	if (!canView) {
		controllersHelpers.notAllowed(req, res);
		return;
	}

	let term = req.params.term || '';
	if (term === 'alltime') {
		term = '';
	}
	const set = `users:reputation${term ? `:${term}` : ''}`;

	const userData = await usersController.getUsers(set, req.uid, req.query);
	const uids = userData.users.map(user => user && user.uid);
	const scores = await db.sortedSetScores(set, uids);
	userData.users.forEach((user, index) => {
		if (user) {
			user.reputation = scores[index] || 0;
		}
	});

	const termToLabelMap = {
		daily: '[[recent:day]]',
		weekly: '[[recent:week]]',
		monthly: '[[recent:month]]',
	};
	const breadcrumbs = [{
		text: term ? termToLabelMap[term] : '[[leaderboard:leaderboard]]',
	}];

	if (term) {
		breadcrumbs.unshift({ text: '[[leaderboard:leaderboard]]', url: '/leaderboard' });
		userData[term] = true;
	}

	userData.breadcrumbs = controllersHelpers.buildBreadcrumbs(breadcrumbs);
	userData['section_sort-reputation'] = true;
	userData.title = '[[leaderboard:leaderboard]]';

	res.render('leaderboard', userData);
};

LeaderboardPlugin.getNavigation = async function (core) {
	core.push({
		route: '/leaderboard',
		title: '[[leaderboard:leaderboard]]',
		enabled: false,
		iconClass: 'fa-star',
		textClass: 'visible-xs-inline',
		text: '[[leaderboard:leaderboard]]',
		properties: {},
		core: false,
	});
	return core;
};

LeaderboardPlugin.onUpvote = function (data) {
	let change = 0;
	if (data.current === 'unvote') {
		change = 1;
	} else if (data.current === 'downvote') {
		change = 2;
	}
	updateLeaderboards(change, data.owner);
};

LeaderboardPlugin.onDownvote = function (data) {
	let change = 0;
	if (data.current === 'unvote') {
		change = -1;
	} else if (data.current === 'upvote') {
		change = -2;
	}
	updateLeaderboards(change, data.owner);
};

LeaderboardPlugin.onUnvote = function (data) {
	let change = 0;
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

LeaderboardPlugin.deactivate = function (data) {
	if (data.id === 'nodebb-plugin-leaderboard') {
		pubsub.publish('nodebb-plugin-leaderboard:deactivate');
	}
};

pubsub.on('nodebb-plugin-leaderboard:deactivate', () => {
	stopCronJobs();
});

function reStartCronJobs() {
	if (nconf.get('isPrimary')) {
		stopCronJobs();
		cronJobs.forEach((job) => {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('isPrimary')) {
		cronJobs.forEach((job) => {
			job.stop();
		});
	}
}

module.exports = LeaderboardPlugin;
