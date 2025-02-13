
<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="users">
	<h3 class="fw-semibold">[[global:users]]</h3>
	<div class="d-flex flex-wrap justify-content-between">
		<div class="mb-2 mb-md-0">
			<div component="user/list/menu" class="text-sm d-flex flex-wrap align-items-center gap-2">
				<a class="btn btn-ghost btn-sm ff-secondary fw-semibold {{{ if daily }}}active{{{ end }}}" href="{config.relative_path}/leaderboard/daily">[[recent:day]]</a>
				<a class="btn btn-ghost btn-sm ff-secondary fw-semibold {{{ if weekly }}}active{{{ end }}}" href="{config.relative_path}/leaderboard/weekly">[[recent:week]]</a>
				<a class="btn btn-ghost btn-sm ff-secondary fw-semibold {{{ if monthly }}}active{{{ end }}}" href="{config.relative_path}/leaderboard/monthly">[[recent:month]]</a>
			</div>
		</div>
	</div>
	<hr/>

	<div id="users-container" class="users-container row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
		{{{ each users }}}
		<!-- IMPORT partials/users/item.tpl -->
		{{{ end }}}
	</div>
</div>
