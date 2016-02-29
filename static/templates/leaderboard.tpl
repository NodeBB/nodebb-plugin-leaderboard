<div class="users">

	<!-- IMPORT partials/breadcrumbs.tpl -->

	<div class="row">
		<div class="col-lg-6">
			<ul class="nav nav-pills">
				<li class="<!-- IF daily -->active<!-- ENDIF daily -->"><a href='{config.relative_path}/leaderboard/daily'>[[recent:day]]</a></li>
				<li class="<!-- IF weekly -->active<!-- ENDIF weekly -->"><a href='{config.relative_path}/leaderboard/weekly'>[[recent:week]]</a></li>
				<li class="<!-- IF monthly -->active<!-- ENDIF monthly -->"><a href='{config.relative_path}/leaderboard/monthly'>[[recent:month]]</a></li>
			</ul>
		</div>
	</div>

	<ul id="users-container" class="users-container">
		<!-- IMPORT partials/users_list.tpl -->
	</ul>
</div>
