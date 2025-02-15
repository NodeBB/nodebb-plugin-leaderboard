<div class="{{{ if sidebar }}}row row-cols-1 px-3{{{ else }}}row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4{{{ end }}} mb-2">
	{{{ each users }}}
	<a href="{config.relative_path}/user/{./userslug}" class="btn btn-ghost d-flex gap-2 ff-secondary align-items-start text-start p-2 ff-base">
		<div class="d-flex gap-2 flex-grow-1">
			{buildAvatar(@value, "48px", true, "flex-shrink-0")}
			<div class="d-flex flex-column gap-1 text-truncate">
				<div class="fw-semibold text-truncate" title="{./displayname}">{./displayname}</div>
				<div class="text-xs text-muted text-truncate">{formattedNumber(./reputation)}</div>
			</div>
		</div>

		<div class="align-self-center position-relative {{{ if !./rankColor}}}invisible{{{ end }}}">
			<i class="fa-solid fa-trophy fa-2x" style="color: {./rankColor};"></i>
			<span style="width:18px; height:18px; text-align: center;" class="mt-1 d-inline-block rounded-circle lh-1 position-absolute top-0 start-50 translate-middle-x fw-bold ff-secondary">{./rank}</span>
		</div>
	</a>
	{{{ end }}}
</div>
