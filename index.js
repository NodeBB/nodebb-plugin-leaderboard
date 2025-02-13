'use strict';

const cron = require.main.require('cron').CronJob;
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');

const controllersHelpers = require.main.require('./src/controllers/helpers');
const usersController = require.main.require('./src/controllers/users');
const db = require.main.require('./src/database');
const privileges = require.main.require('./src/privileges');
const user = require.main.require('./src/user');
const pubsub = require.main.require('./src/pubsub');
const helpers = require.main.require('./src/routes/helpers');


const cronJobs = [];
cronJobs.push(new cron('0 0 17 * * *', (() => { deleteSet('users:reputation:daily'); }), null, false));
cronJobs.push(new cron('0 0 17 * * 0', (() => { deleteSet('users:reputation:weekly'); }), null, false));
cronJobs.push(new cron('0 0 17 1 * *', (() => { deleteSet('users:reputation:monthly'); }), null, false));


async function deleteSet(set) {
	try {
		await db.delete(set);
	} catch (err) {
		winston.error(err.stack);
	}
}

const LeaderboardPlugin = module.exports;

let app;

LeaderboardPlugin.init = async function (params) {
	app = params.app;
	helpers.setupPageRoute(params.router, '/leaderboard/:term?', params.middleware, [], LeaderboardPlugin.renderLeaderboardPage);
	reStartCronJobs();
};

LeaderboardPlugin.defineWidgets = async (widgets) => {
	const widgetData = [
		{
			widget: 'leaderboard',
			name: 'Leaderboard',
			description: 'User leaderboard based on reputation',
			content: 'admin/partials/widgets/leaderboard.tpl',
		},
	];

	await Promise.all(widgetData.map(async (widget) => {
		widget.content = await app.renderAsync(widget.content, {});
	}));

	widgets = widgets.concat(widgetData);

	return widgets;
};

LeaderboardPlugin.renderLeaderboardWidget = async function (widget) {
	const numUsers = parseInt(widget.data.numUsers, 10) || 8;
	const term = widget.data.term || 'monthly';
	const set = `users:reputation:${term}`;
	const sidebarLocations = ['left', 'right', 'sidebar'];
	const userData = await user.getUsersFromSet(set, widget.uid, 0, numUsers - 1);
	const uids = userData.map(user => user && user.uid);
	const scores = await db.sortedSetScores(set, uids);
	const rankToColor = {
		0: 'gold',
		1: 'silver',
		2: 'sandybrown',
	};
	userData.forEach((user, index) => {
		if (user) {
			user.reputation = scores[index] || 0;
			user.rankColor = rankToColor[index] || '';
			user.rank = index + 1;
		}
	});
	widget.html = await app.renderAsync('widgets/leaderboard', {
		users: userData,
		sidebar: sidebarLocations.includes(widget.location),
		config: widget.templateData.config,
		relative_path: nconf.get('relative_path'),
	});
	return widget;
};

LeaderboardPlugin.renderLeaderboardPage = async function (req, res) {
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
	userData.section_joindate = false;
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

LeaderboardPlugin.onUpvote = async function (data) {
	let change = 0;
	if (data.current === 'unvote') {
		change = 1;
	} else if (data.current === 'downvote') {
		change = 2;
	}
	await updateLeaderboards(change, data.owner);
};

LeaderboardPlugin.onDownvote = async function (data) {
	let change = 0;
	if (data.current === 'unvote') {
		change = -1;
	} else if (data.current === 'upvote') {
		change = -2;
	}
	await updateLeaderboards(change, data.owner);
};

LeaderboardPlugin.onUnvote = async function (data) {
	let change = 0;
	if (data.current === 'upvote') {
		change = -1;
	} else if (data.current === 'downvote') {
		change = 1;
	}
	await updateLeaderboards(change, data.owner);
};

async function updateLeaderboards(change, owner) {
	if (change) {
		await Promise.all([
			db.sortedSetIncrBy('users:reputation:daily', change, owner),
			db.sortedSetIncrBy('users:reputation:weekly', change, owner),
			db.sortedSetIncrBy('users:reputation:monthly', change, owner),
		]);
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
