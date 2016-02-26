
'use strict';

var async = require.main.require('async');
var cron = require.main.require('cron').CronJob;
var nconf = require.main.require('nconf');

var db = require.main.require('./src/database');
var helpers = require.main.require('./src/routes/helpers');
var controllersHelpers = require.main.require('./src/controllers/helpers');
var usersController = require.main.require('./src/controllers/users');
var pubsub = require.main.require('./src/pubsub');

var plugin = {};

var cronJobs = [];

cronJobs.push(new cron('0 0 * * *', function() {db.delete('users:reputation:daily');}, null, false));
cronJobs.push(new cron('0 0 * * 0', function() {db.delete('users:reputation:weekly');}, null, false));
cronJobs.push(new cron('0 0 1 * *', function() {db.delete('users:reputation:monthly');}, null, false));

plugin.init = function(params, callback) {
	var middlewares = [params.middleware.checkGlobalPrivacySettings];
	helpers.setupPageRoute(params.router, '/leaderboard/:term?', params.middleware, middlewares, plugin.renderLeaderboard);
	reStartCronJobs();
	callback();
};

plugin.renderLeaderboard = function(req, res, next) {
	var term = req.params.term || '';
	if (term === 'alltime') {
		term = '';
	}
	var set = 'users:reputation' + (term ? ':' + term : '');

	var userData;
	async.waterfall([
		function (next) {
			usersController.getUsers(set, req.uid, req.query.page, next);
		},
		function (_userData, next) {
			userData = _userData;
			var uids = userData.users.map(function(user) {
				return user && user.uid;
			});
			db.sortedSetScores(set, uids, next);
		},
		function (scores, next) {
			userData.users.forEach(function(user, index) {
				if (user) {
					user.reputation = scores[index] || 0;
				}
			});
			next(null, userData);
		}
	], function(err, userData) {
		if (err) {
			return next(err);
		}
		var breadcrumbs = [{text: term ? (term.charAt(0).toUpperCase() + term.slice(1)) : 'Leaderboard'}];

		if (term) {
			breadcrumbs.unshift({text: 'Leaderboard', url: '/leaderboard'});
			userData[term] = true;
		}

		userData.breadcrumbs = controllersHelpers.buildBreadcrumbs(breadcrumbs);
		userData['route_users:reputation'] = true;
		userData.title = 'Leaderboard';
		res.render('leaderboard', userData);
	});
};

plugin.getNavigation = function(core, callback) {
	core.push([
		{
			route: '/leaderboard',
			title: 'Leaderboard',
			enabled: true,
			iconClass: 'fa-star',
		    textClass: 'visible-xs-inline',
		    text: '',
		    properties: {  },
		    core: true
		}
	]);
	callback(null, core);
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

plugin.activate = function(id) {
	if (id === 'nodebb-plugin-leaderboard') {
		pubsub.publish('nodebb-plugin-leaderboard:activate');
	}
};

plugin.deactivate = function(id) {
	if (id === 'nodebb-plugin-leaderboard') {
		pubsub.publish('nodebb-plugin-leaderboard:deactivate');
	}
};

pubsub.on('nodebb-plugin-leaderboard:activate', function() {
	reStartCronJobs();
});

pubsub.on('nodebb-plugin-leaderboard:deactivate', function() {
	stopCronJobs();
});


function reStartCronJobs() {
	if (nconf.get('isPrimary') === 'true') {
		stopCronJobs();
		cronJobs.forEach(function(job) {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('isPrimary') === 'true') {
		cronJobs.forEach(function(job) {
			job.stop();
		});
	}
}



module.exports = plugin;

