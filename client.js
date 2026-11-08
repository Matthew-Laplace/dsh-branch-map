window.__ModuleLoader__.load({
  id: 'dsh-branch-map',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback, useMemo } = React

    const ROW_PITCH = 172
    const LANE_PITCH = 304
    const NODE_W = 236
    const NODE_H = 122
    const LANE_H = 178
    const LEFT_PAD = 64
    const TOP_PAD = 104
    const TAIL_TURNS = 5
    const ALL_THRESHOLD = 10
    const PENDING_PREFIX = 'dsh-branch-map:pending:'
    const WALK_KEY = 'dsh-branch-map:walk'
    const MODE_KEY = 'dsh-branch-map:mode'
    const TREE_NODE_W = 264
    const TREE_NODE_H = 72
    const TREE_GAP_X = 24
    const TREE_GAP_Y = 40
    const TREE_DEPTH_Y = TREE_NODE_H + TREE_GAP_Y
    const COLORS = [
      'var(--dsw-alias-brand-primary, #6aa2ff)',
      'var(--dsw-alias-state-success-primary, #3fb56b)',
      'var(--dsw-alias-state-warn-primary, #d3a03a)',
      'var(--dsw-alias-state-error-primary, #d95b5b)',
      'var(--dsw-alias-state-idle-primary, #98a0ac)',
    ]

    const CSS = `
.bm-root { display:flex; flex-direction:column; height:100%; min-height:440px; min-width:0; font-size:13px; color:var(--dsw-alias-label-primary, inherit); -webkit-font-smoothing:antialiased; }
.bm-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 14px 8px; flex:none; }
.bm-title { font-weight:600; font-size:14px; letter-spacing:.2px; }
.bm-sub { color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); font-size:12px; max-width:32vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bm-chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; line-height:1.5; padding:1px 7px; border-radius:999px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.28)) 75%, transparent); color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); background:var(--dsw-alias-bg-layer-1, transparent); }
.bm-dot { width:6px; height:6px; border-radius:50%; flex:none; }
.bm-spacer { flex:1; }
.bm-btn { font:inherit; font-size:12px; line-height:1.5; padding:4px 9px; border-radius:8px; border:1px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); cursor:pointer; transition:background .12s, color .12s, border-color .12s; }
.bm-btn:hover { background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.12)); color:var(--dsw-alias-label-primary, inherit); }
.bm-btn:disabled { opacity:.4; cursor:default; }
.bm-btn-on { border-color:var(--dsw-alias-border-l1, rgba(128,128,128,.3)); color:var(--dsw-alias-label-primary, inherit); }
.bm-btn-primary { border-color:var(--dsw-alias-brand-primary, #6aa2ff); color:var(--dsw-alias-brand-primary, #6aa2ff); }
.bm-hint { font-size:11px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.8)); padding:0 14px 8px; flex:none; }
.bm-viewport { position:relative; flex:1; min-height:340px; overflow:hidden; touch-action:none; cursor:grab; border-top:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.2)) 80%, transparent); background:var(--dsw-alias-bg-base, transparent); }
.bm-viewport.bm-dragging { cursor:grabbing; }
.bm-viewport.bm-walk { cursor:ns-resize; }
.bm-grid { position:absolute; inset:0; pointer-events:none; opacity:.45; background-image:radial-gradient(circle, var(--dsw-alias-border-l1, rgba(128,128,128,.35)) 1px, transparent 1px); }
.bm-world { position:absolute; left:0; top:0; transform-origin:0 0; }
.bm-edges { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.bm-edge { fill:none; stroke-width:2; stroke-linecap:round; opacity:.72; }
.bm-edge-dim { opacity:.28; }
.bm-link { fill:none; stroke-width:1.5; stroke-linecap:round; opacity:.3; }
.bm-link-active { opacity:.6; }
.bm-node { position:absolute; width:${NODE_W}px; height:${NODE_H}px; box-sizing:border-box; display:flex; flex-direction:column; gap:4px; padding:10px 12px 9px; border-radius:12px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.26)) 68%, transparent); border-left:3px solid var(--dsw-alias-brand-primary, #6aa2ff); background:var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06)); color:inherit; text-align:left; cursor:pointer; overflow:hidden; font:inherit; box-shadow:0 1px 2px rgba(0,0,0,.16); transition:border-color .12s, box-shadow .12s; }
.bm-node:hover { border-color:var(--dsw-alias-border-l2, rgba(128,128,128,.55)); box-shadow:0 6px 18px rgba(0,0,0,.22); }
.bm-node:focus-visible { outline:2px solid var(--dsw-alias-brand-primary, #6aa2ff); outline-offset:2px; }
.bm-node:hover .bm-fork { opacity:1; }
.bm-node.bm-current { box-shadow:0 0 0 1.5px var(--dsw-alias-brand-primary, #6aa2ff), 0 4px 14px rgba(0,0,0,.16); }
.bm-node.bm-selected { outline:2px solid var(--dsw-alias-state-warn-primary, #d3a03a); outline-offset:2px; z-index:4; }
.bm-viewport.bm-walk .bm-node:not(.bm-selected) { opacity:.5; }
.bm-node.bm-dim { opacity:.55; }
.bm-node.bm-active { background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08)); }
.bm-node-head { display:flex; align-items:center; gap:6px; flex:none; min-width:0; }
.bm-node-idx { font-size:10px; opacity:.55; flex:none; margin-left:auto; }
.bm-fork { margin-left:2px; font:inherit; font-size:12px; line-height:1; padding:2px 5px; border-radius:6px; border:1px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary, inherit); cursor:pointer; flex:none; opacity:0; transition:opacity .12s; }
.bm-fork:hover { border-color:var(--dsw-alias-brand-primary, #6aa2ff); color:var(--dsw-alias-brand-primary, #6aa2ff); }
.bm-fork:focus-visible { opacity:1; }
@media (hover:none) { .bm-fork { opacity:1; } }
.bm-branch-chip { flex:none; font:inherit; font-size:10px; line-height:1.4; padding:1px 6px; border-radius:999px; border:1px solid color-mix(in oklab, var(--dsw-alias-brand-primary, #6aa2ff) 55%, transparent); background:transparent; color:var(--dsw-alias-brand-primary, #6aa2ff); cursor:pointer; }
.bm-branch-chip:hover, .bm-branch-chip.bm-branch-chip-on { background:color-mix(in oklab, var(--dsw-alias-brand-primary, #6aa2ff) 16%, transparent); }
.bm-kind { flex:none; font-size:9px; line-height:1.6; padding:0 6px; border-radius:5px; border:1px solid currentColor; opacity:.92; }
.bm-kind-ask { color:var(--dsw-alias-state-warn-primary, #d3a03a); }
.bm-kind-conclusion { color:var(--dsw-alias-state-success-primary, #3fb56b); background:color-mix(in oklab, var(--dsw-alias-state-success-primary, #3fb56b) 14%, transparent); }
.bm-kind-status { color:var(--dsw-alias-brand-primary, #6aa2ff); }
.bm-node-summary { flex:none; font-size:12.5px; line-height:1.5; font-weight:500; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.bm-node-user { margin-top:auto; flex:none; display:flex; align-items:baseline; gap:5px; padding-top:5px; border-top:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 55%, transparent); min-width:0; }
.bm-user-tag { flex:none; font-size:9px; line-height:1.6; padding:0 5px; border-radius:4px; background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.14)); color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); }
.bm-user-tag-decision { border:1px solid var(--dsw-alias-state-warn-primary, #d3a03a); color:var(--dsw-alias-state-warn-primary, #d3a03a); background:transparent; }
.bm-user-text { flex:1; min-width:0; font-size:11px; line-height:1.5; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bm-node.bm-lod { padding:8px 10px; gap:2px; }
.bm-node.bm-lod .bm-node-user, .bm-node.bm-lod .bm-fork { display:none; }
.bm-node.bm-lod .bm-branch-chip { display:inline-flex; }
.bm-node.bm-lod .bm-node-summary { -webkit-line-clamp:1; }
.bm-node.bm-lod .bm-node-head { gap:4px; }
.bm-gap { position:absolute; height:40px; box-sizing:border-box; padding:0 12px; border-radius:999px; border:1px dashed color-mix(in oklab, var(--dsw-alias-border-l2, rgba(128,128,128,.5)) 70%, transparent); background:var(--dsw-alias-bg-layer-1, rgba(128,128,128,.05)); color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); font:inherit; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; }
.bm-gap:hover { border-style:solid; border-color:var(--dsw-alias-brand-primary, #6aa2ff); color:var(--dsw-alias-label-primary, inherit); }
.bm-lane { position:absolute; display:flex; align-items:center; gap:7px; max-width:460px; padding:3px 9px 3px 8px; border-radius:999px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 75%, transparent); background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.1)); font-size:11px; line-height:1.6; white-space:nowrap; cursor:pointer; }
.bm-lane.bm-dim { opacity:.5; }
.bm-lane.bm-lane-current { border-color:var(--dsw-alias-brand-primary, #6aa2ff); }
.bm-lane-name { font-weight:600; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
.bm-lane-meta { color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); }
.bm-lane-actions { display:flex; gap:4px; opacity:0; transition:opacity .12s; }
.bm-lane:hover .bm-lane-actions, .bm-lane:focus-within .bm-lane-actions { opacity:1; }
.bm-lane-btn { font:inherit; font-size:10px; line-height:1.3; padding:2px 6px; border-radius:6px; border:1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3)); background:var(--dsw-alias-bg-layer-1, transparent); color:var(--dsw-alias-label-secondary, inherit); cursor:pointer; }
.bm-lane-btn:hover { border-color:var(--dsw-alias-brand-primary, #6aa2ff); color:var(--dsw-alias-brand-primary, #6aa2ff); }
.bm-legend { display:flex; align-items:center; gap:12px; font-size:11px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.85)); }
.bm-legend span { display:inline-flex; align-items:center; gap:5px; }
.bm-inspector { position:absolute; left:14px; bottom:64px; width:min(380px, 72%); max-height:48%; overflow:auto; box-sizing:border-box; padding:12px 14px; border-radius:12px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l2, rgba(128,128,128,.5)) 70%, transparent); background:var(--dsw-alias-bg-overlay, rgba(20,20,20,.96)); box-shadow:0 12px 36px rgba(0,0,0,.32); z-index:3; display:flex; flex-direction:column; gap:7px; }
.bm-insp-head { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); }
.bm-insp-title { font-weight:600; font-size:12px; color:var(--dsw-alias-label-primary, inherit); }
.bm-insp-close { margin-left:auto; }
.bm-insp-body { font-size:12px; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
.bm-insp-user { font-size:11.5px; line-height:1.5; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); border-top:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 60%, transparent); padding-top:6px; }
.bm-insp-actions { display:flex; gap:6px; flex-wrap:wrap; }
.bm-error { margin:0 14px 8px; padding:8px 10px; border-radius:8px; border:1px solid var(--dsw-alias-state-error-primary, #d95b5b); color:var(--dsw-alias-state-error-primary, #d95b5b); font-size:12px; display:flex; gap:10px; align-items:flex-start; flex:none; }
.bm-error span:first-child { flex:1; word-break:break-word; }
.bm-empty { position:absolute; inset:0; display:flex; flex-direction:column; gap:6px; align-items:center; justify-content:center; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); font-size:12px; }
.bm-empty strong { font-size:13px; color:var(--dsw-alias-label-primary, inherit); font-weight:600; }
.bm-zoom { position:absolute; right:14px; bottom:14px; display:flex; align-items:center; gap:2px; padding:3px; border-radius:10px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.28)) 75%, transparent); background:var(--dsw-alias-bg-overlay, rgba(255,255,255,.9)); box-shadow:0 4px 16px rgba(0,0,0,.18); z-index:2; }
.bm-zoom .bm-btn { padding:4px 8px; }
.bm-zoom-pct { font-size:11px; min-width:38px; text-align:center; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); }
.bm-body { flex:1; display:flex; min-height:0; min-width:0; position:relative; }
.bm-side { flex:0 0 46%; max-width:620px; min-width:300px; display:flex; flex-direction:column; min-height:0; border-left:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 80%, transparent); background:var(--dsw-alias-bg-layer-1, rgba(128,128,128,.04)); }
.bm-side-head { display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 70%, transparent); flex:none; font-size:12px; }
.bm-side-title { font-weight:600; font-size:12px; }
.bm-side-count { color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); font-size:11px; }
.bm-side-head .bm-btn { margin-left:auto; }
.bm-side-detailbox { flex:none; max-height:46%; overflow:auto; padding:10px 12px 11px; border-bottom:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 70%, transparent); display:flex; flex-direction:column; gap:6px; }
.bm-side-list { flex:1; overflow:auto; padding:6px 10px 16px; display:flex; flex-direction:column; gap:6px; }
.bm-side-row { box-sizing:border-box; min-height:50px; padding:7px 10px; border-radius:10px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 65%, transparent); background:transparent; cursor:pointer; display:flex; flex-direction:column; justify-content:center; gap:2px; color:inherit; font:inherit; text-align:left; min-width:0; }
.bm-side-row:hover { border-color:var(--dsw-alias-border-l2, rgba(128,128,128,.55)); }
.bm-side-row-on { border-color:var(--dsw-alias-brand-primary, #6aa2ff); background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08)); }
.bm-side-row-top { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); }
.bm-side-idx { opacity:.6; }
.bm-side-steps { margin-left:auto; opacity:.6; font-size:10px; }
.bm-side-ai { font-size:12px; line-height:1.4; font-weight:500; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
.bm-side-user { font-size:11px; line-height:1.45; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); display:flex; gap:5px; align-items:baseline; min-width:0; }
.bm-side-user-text { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bm-side-detail { font-size:11.5px; line-height:1.55; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); white-space:pre-wrap; word-break:break-word; border-top:1px dashed color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 75%, transparent); padding-top:5px; margin-top:2px; }
.bm-side-detail-user { color:var(--dsw-alias-label-secondary, rgba(128,128,128,.85)); }
.bm-side-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
.bm-context-dialog { width:min(560px, 94vw); max-height:80vh; overflow:auto; }
.bm-preview-list { display:flex; flex-direction:column; gap:10px; }
.bm-preview-section { display:flex; flex-direction:column; gap:4px; }
.bm-preview-session { font-size:12px; font-weight:600; display:flex; gap:6px; align-items:center; }
.bm-preview-hidden { font-size:10px; color:var(--dsw-alias-state-warn-primary, #d3a03a); }
.bm-preview-row { display:flex; gap:6px; align-items:baseline; font-size:11.5px; line-height:1.45; min-width:0; }
.bm-preview-row .bm-kind { flex:none; }
.bm-preview-text { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); }
.bm-preview-empty { font-size:11px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); }
.bm-dialog-error { font-size:11.5px; line-height:1.5; color:var(--dsw-alias-state-error-primary, #e5484d); padding:6px 8px; border-radius:6px; background:color-mix(in oklab, var(--dsw-alias-state-error-primary, #e5484d) 9%, transparent); }
.bm-dialog-warn { font-size:11.5px; line-height:1.5; color:var(--dsw-alias-state-warn-primary, #d3a03a); padding:6px 8px; border-radius:6px; background:color-mix(in oklab, var(--dsw-alias-state-warn-primary, #d3a03a) 9%, transparent); }
@media (max-width: 760px) {
.bm-body { flex-direction:column; }
.bm-side { flex:0 0 auto; width:100%; max-width:none; max-height:46%; border-left:none; border-top:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.3)) 80%, transparent); }
}
.bm-kind-conclusion { background:color-mix(in oklab, var(--dsw-alias-state-success-primary, #3fb56b) 16%, transparent); }
.bm-user-tag-decision { border:1px solid var(--dsw-alias-state-warn-primary, #d3a03a); color:var(--dsw-alias-state-warn-primary, #d3a03a); background:transparent; }
.bm-lane-main { font-size:9px; line-height:1.6; padding:0 5px; border-radius:4px; border:1px solid var(--dsw-alias-state-success-primary, #3fb56b); color:var(--dsw-alias-state-success-primary, #3fb56b); }
.bm-conclusions { display:flex; align-items:center; gap:8px; padding:0 14px 8px; overflow:auto; flex:none; }
.bm-conclusions-label { flex:none; font-size:11px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.9)); }
.bm-conclusion-chip { flex:none; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:inherit; font-size:11px; padding:3px 9px; border-radius:999px; border:1px solid color-mix(in oklab, var(--dsw-alias-state-success-primary, #3fb56b) 45%, transparent); background:transparent; color:inherit; cursor:pointer; }
.bm-conclusion-chip:hover { border-color:var(--dsw-alias-state-success-primary, #3fb56b); color:var(--dsw-alias-state-success-primary, #3fb56b); }
.bm-side-row-conclusion { border-left:3px solid var(--dsw-alias-state-success-primary, #3fb56b); }
.bm-center-mark { position:absolute; left:0; right:0; top:50%; height:0; border-top:1px dashed color-mix(in oklab, var(--dsw-alias-brand-primary, #6aa2ff) 55%, transparent); pointer-events:none; z-index:1; }
.bm-center-mark span { position:absolute; left:10px; top:-9px; font-size:10px; line-height:16px; padding:0 5px; border-radius:4px; color:var(--dsw-alias-brand-primary, #6aa2ff); background:var(--dsw-alias-bg-base, transparent); }
.bm-mask { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; }
.bm-dialog { width:min(480px, 92vw); box-sizing:border-box; padding:16px; border-radius:12px; background:var(--dsw-alias-bg-overlay, #fff); color:var(--dsw-alias-label-primary, #111); border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.5)); box-shadow:0 16px 48px rgba(0,0,0,.28); display:flex; flex-direction:column; gap:10px; }
.bm-dialog h3 { margin:0; font-size:14px; }
.bm-dialog p { margin:0; font-size:12px; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); line-height:1.5; }
.bm-input, .bm-textarea { width:100%; box-sizing:border-box; font:inherit; font-size:13px; padding:7px 9px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35)); background:var(--dsw-alias-bg-layer-1, transparent); color:inherit; }
.bm-textarea { min-height:120px; resize:vertical; line-height:1.5; }
.bm-actions { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.bm-seg { display:inline-flex; align-items:center; padding:2px; border-radius:999px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.28)) 75%, transparent); background:var(--dsw-alias-bg-layer-1, transparent); flex:none; }
.bm-seg-btn { font:inherit; font-size:11px; line-height:1.5; padding:2px 9px; border-radius:999px; border:1px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); cursor:pointer; }
.bm-seg-btn:hover { color:var(--dsw-alias-label-primary, inherit); }
.bm-seg-btn.bm-seg-on { border-color:var(--dsw-alias-brand-primary, #6aa2ff); color:var(--dsw-alias-brand-primary, #6aa2ff); background:color-mix(in oklab, var(--dsw-alias-brand-primary, #6aa2ff) 12%, transparent); }
.bm-tree { position:absolute; left:0; top:0; transform-origin:0 0; }
.bm-tree-edges { position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }
.bm-tree-edge-dim { opacity:.3; }
.bm-tn { position:absolute; width:${TREE_NODE_W}px; height:${TREE_NODE_H}px; box-sizing:border-box; display:flex; flex-direction:column; gap:3px; padding:7px 10px; border-radius:10px; border:1px solid color-mix(in oklab, var(--dsw-alias-border-l1, rgba(128,128,128,.26)) 68%, transparent); border-left:3px solid var(--bm-tn-color, var(--dsw-alias-brand-primary, #6aa2ff)); background:var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06)); color:inherit; text-align:left; cursor:pointer; overflow:hidden; font:inherit; box-shadow:0 1px 2px rgba(0,0,0,.16); transition:border-color .12s, box-shadow .12s, opacity .12s; }
.bm-tn:hover { border-color:var(--dsw-alias-border-l2, rgba(128,128,128,.55)); box-shadow:0 6px 18px rgba(0,0,0,.22); }
.bm-tn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary, #6aa2ff); outline-offset:2px; }
.bm-tn.bm-tn-side { opacity:.55; }
.bm-tn.bm-tn-path { background:var(--dsw-alias-bg-layer-2, rgba(128,128,128,.09)); }
.bm-tn.bm-tn-current { box-shadow:0 0 0 1.5px var(--dsw-alias-brand-primary, #6aa2ff), 0 4px 14px rgba(0,0,0,.16); }
.bm-tn.bm-tn-selected { outline:2px solid var(--dsw-alias-state-warn-primary, #d3a03a); outline-offset:2px; z-index:4; }
.bm-tn.bm-tn-gap { border-style:dashed; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); }
.bm-tn-head { display:flex; align-items:center; gap:5px; flex:none; min-width:0; }
.bm-tn-idx { font-size:10px; opacity:.55; flex:none; margin-left:auto; }
.bm-tn-gap-tag { flex:none; font-size:9px; line-height:1.6; padding:0 5px; border-radius:4px; border:1px dashed currentColor; opacity:.9; }
.bm-tn-title { flex:none; font-size:12px; line-height:1.35; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bm-tn-sub { margin-top:auto; flex:none; font-size:10.5px; line-height:1.3; color:var(--dsw-alias-label-secondary, rgba(128,128,128,.95)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bm-tn.bm-tn-compact .bm-tn-sub { display:none; }
.bm-tn.bm-tn-dot { padding:0; align-items:center; justify-content:center; border-color:transparent; border-left-color:transparent; background:transparent; box-shadow:none; }
.bm-tn.bm-tn-dot .bm-tn-head, .bm-tn.bm-tn-dot .bm-tn-title, .bm-tn.bm-tn-dot .bm-tn-sub, .bm-tn.bm-tn-dot .bm-branch-chip { display:none; }
.bm-tn-dot-mark { display:none; width:12px; height:12px; border-radius:50%; background:var(--bm-tn-color, var(--dsw-alias-brand-primary, #6aa2ff)); }
.bm-tn.bm-tn-dot .bm-tn-dot-mark { display:block; }
`

    const BRANCH_REGISTRY_KEY = 'dsh-branch-map:branches'
    const HIDDEN_KEY = 'dsh-branch-map:hidden'

    function readHiddenMap() {
      try {
        const value = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) || '{}')
        return value && typeof value === 'object' ? value : {}
      } catch {
        return {}
      }
    }

    function writeHiddenMap(map) {
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(map))
      } catch {
        // 本机隐藏偏好写入失败不影响显示
      }
    }

    function readBranchRegistry() {
      try {
        const value = JSON.parse(window.localStorage.getItem(BRANCH_REGISTRY_KEY) || '{}')
        return value && typeof value === 'object' ? value : {}
      } catch {
        return {}
      }
    }

    function writeBranchRegistry(registry) {
      try {
        window.localStorage.setItem(BRANCH_REGISTRY_KEY, JSON.stringify(registry))
      } catch {
        // 本机注册失败时只能依赖 Host 侧 meta
      }
    }

    /**
     * Host 的 fork 子会话没有 header.parentSession，且 readSurface 含继承前缀；
     * 这里用本地分支注册表补血缘，并按 inheritedEventCount 去掉继承轮次。
     */
    async function loadGraph(sessionId) {
      const data = await callHost({ action: 'graph', sessionId })
      const registry = readBranchRegistry()
      const sessions = { ...(data.sessions || {}) }
      const family = new Set(Object.keys(sessions))
      let changed = true
      let guard = 0
      while (changed && guard < 20) {
        changed = false
        guard += 1
        for (const id of [...family]) {
          const parentId = sessions[id]?.parentId || registry[id]?.parentId
          if (parentId && !family.has(parentId)) {
            family.add(parentId)
            changed = true
          }
          for (const [childId, entry] of Object.entries(registry)) {
            if (entry?.parentId === id && !family.has(childId)) {
              family.add(childId)
              changed = true
            }
          }
        }
      }
      const missing = [...family].filter((id) => !sessions[id]).slice(0, 24)
      for (const id of missing) {
        try {
          const extra = await callHost({ action: 'graph', sessionId: id })
          for (const [sid, session] of Object.entries(extra.sessions || {})) {
            if (!sessions[sid]) sessions[sid] = session
          }
        } catch {
          // 会话可能已被删除或迁移，跳过即可
        }
      }
      for (const [id, entry] of Object.entries(registry)) {
        if (!sessions[id] || !entry) continue
        const parentId = typeof entry.parentId === 'string' && sessions[entry.parentId] ? entry.parentId : sessions[id].parentId
        sessions[id] = {
          ...sessions[id],
          parentId,
          forkSeq: Number.isFinite(entry.forkSeq) ? entry.forkSeq : sessions[id].forkSeq,
          label: sessions[id].label || (typeof entry.label === 'string' ? entry.label : ''),
        }
      }
      for (const [id, session] of Object.entries(sessions)) {
        const inherited = Number.isFinite(session.inheritedEventCount) ? session.inheritedEventCount : 0
        let turns = Array.isArray(session.turns) ? session.turns.filter(Boolean) : []
        if (inherited > 0 && !session.derived) {
          turns = turns.filter((turn) => typeof turn.userSeq !== 'number' || turn.userSeq >= inherited)
        }
        const hiddenMap = readHiddenMap()
        const localHidden = Array.isArray(hiddenMap[id]) ? hiddenMap[id] : []
        const hostHidden = Array.isArray(session.hiddenSeqs) ? session.hiddenSeqs : []
        const hiddenSeqs = [...new Set([...localHidden, ...hostHidden].filter((value) => Number.isFinite(value)))]
        let hiddenCount = 0
        if (hiddenSeqs.length > 0) {
          turns = turns.filter((turn) => {
            if (typeof turn.userSeq === 'number' && hiddenSeqs.includes(turn.userSeq)) {
              hiddenCount += 1
              return false
            }
            return true
          })
        }
        sessions[id] = { ...session, turns, hiddenSeqs, hiddenCount }
      }
      for (const [id, session] of Object.entries(sessions)) {
        if (session.parentId && !sessions[session.parentId]) sessions[id] = { ...session, parentId: null }
      }
      let root = data.root
      if (!sessions[root]) root = sessionId
      let rootGuard = 0
      while (rootGuard < 500) {
        const parentId = sessions[root]?.parentId
        if (!parentId || !sessions[parentId]) break
        root = parentId
        rootGuard += 1
      }
      const order = [...new Set([...(data.order || []), ...Object.keys(sessions)])].filter((id) => sessions[id])
      return { ...data, root, sessions, order }
    }

    async function callHost(input) {
      const transport =
        typeof window !== 'undefined' && window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__.fetch
      const send = transport || (typeof window !== 'undefined' ? window.fetch.bind(window) : null)
      if (!send) throw new Error('当前环境没有可用的 HTTP 通道')
      const response = await send('/api/branch-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }
      if (!response.ok || !data || data.error) {
        throw new Error(data && data.error ? data.error : `请求失败（HTTP ${response.status}）`)
      }
      return data
    }

    function clip(text, limit) {
      const value = String(text ?? '').replace(/\s+/g, ' ').trim()
      return value.length > limit ? `${value.slice(0, limit)}…` : value
    }

    function sentencesOf(text) {
      return String(text ?? '')
        .replace(/\s+/g, ' ')
        .split(/(?<=[。！？!?])\s*/)
        .map((line) => line.trim())
        .filter(Boolean)
    }

    const CONTEXT_PATTERNS = [
      /^<system-reminder>/i,
      /^Current runtime context/i,
      /^Time sampled while preparing/i,
    ]

    function summarizeUser(text) {
      const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
      if (!raw) return { kind: 'context', tag: '系统', summary: '（空输入）', detail: '' }
      if (CONTEXT_PATTERNS.some((pattern) => pattern.test(raw))) {
        return { kind: 'context', tag: '系统', summary: '运行上下文 / 系统提醒', detail: raw }
      }
      if (/^Background subagent/i.test(raw)) {
        return { kind: 'subtask', tag: '回报', summary: `子任务回报：${clip(raw.replace(/^Background subagent\s*\S*\s*[:：]?\s*/i, ''), 40)}`, detail: raw }
      }
      if (/^Team message from/i.test(raw)) {
        return { kind: 'subtask', tag: '回报', summary: `子任务消息：${clip(raw.replace(/^Team message from\s+\S+\s*[:：]?\s*/i, ''), 42)}`, detail: raw }
      }
      let clean = raw.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '')
      const sentences = sentencesOf(clean)
      const decision = sentences.find((sentence) =>
        /(就按|采用|确认|决定|优先|选\s*[A-Za-z0-9一二三]|不用|取消|保留|同意|通过|按你|听你的|不要|改成|换成)/.test(sentence),
      )
      if (decision) {
        return { kind: 'decision', tag: '决策', summary: clip(decision, 46), detail: clip(raw, 180) }
      }
      const desire = sentences.find((sentence) => /(希望|想要|需要|帮我|请|要求|目标|我想|要它|确认|看一下|检查)/.test(sentence))
      return {
        kind: 'intent',
        tag: '你',
        summary: clip(desire || sentences[0] || clean, 46),
        detail: clip(raw, 180),
      }
    }

    const ASK_RE = /(需要你|请确认|确认一下|需要提供|请提供|你希望|你想|要不要|是否|告诉我|请选择|下一步|确认后|需要确认|待确认|你看|你看是否)/
    const CONCLUSION_RE = /(结论|总结|已完成|验证通过|建议|因此|所以|最终|综上|已经完成|修复完成)/

    function summarizeAssistant(text, steps) {
      const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
      if (!raw) {
        return {
          kind: 'status',
          tag: steps > 0 ? '进展' : '等待',
          summary: steps > 0 ? `执行了 ${steps} 步工具调用` : '等待回复…',
          detail: '',
        }
      }
      const clean = raw
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*_`>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const sentences = sentencesOf(clean)
      const ask = sentences.find((sentence) => ASK_RE.test(sentence))
      const conclusion = sentences.find((sentence) => CONCLUSION_RE.test(sentence))
      if (ask) return { kind: 'ask', tag: '需要你', summary: clip(ask, 68), detail: clip(raw, 240) }
      if (conclusion) {
        return { kind: 'conclusion', tag: '结论', summary: clip(conclusion, 68), detail: clip(raw, 240) }
      }
      return { kind: 'status', tag: '进展', summary: clip(sentences.slice(0, 2).join('') || clean, 68), detail: clip(raw, 240) }
    }

    function forkIndexIn(session, forkSeq) {
      const turns = session?.turns ?? []
      if (turns.length === 0) return null
      if (forkSeq == null) return turns.length - 1
      let index = null
      turns.forEach((turn, i) => {
        if (turn && turn.userSeq != null && turn.userSeq <= forkSeq) index = i
      })
      return index == null ? 0 : index
    }

    function statusLabel(status) {
      if (status === 'concluded') return '已结论'
      if (status === 'returned') return '已回填'
      return '进行中'
    }

    function buildItems(session, forkTurns, expanded, expandAll) {
      const turns = session.turns ?? []
      if (turns.length === 0) return []
      if (expandAll || turns.length <= ALL_THRESHOLD) {
        return turns.map((turn, index) => ({ kind: 'turn', index, turn }))
      }
      const visible = new Set([0])
      for (let i = Math.max(0, turns.length - TAIL_TURNS); i < turns.length; i += 1) visible.add(i)
      for (const index of forkTurns) if (index >= 0 && index < turns.length) visible.add(index)
      const items = []
      let index = 0
      while (index < turns.length) {
        if (visible.has(index)) {
          items.push({ kind: 'turn', index, turn: turns[index] })
          index += 1
          continue
        }
        const from = index
        while (index < turns.length && !visible.has(index)) index += 1
        const to = index - 1
        const key = `${session.sessionId}:${from}`
        if (expanded[key]) {
          for (let k = from; k <= to; k += 1) items.push({ kind: 'turn', index: k, turn: turns[k] })
        } else {
          items.push({ kind: 'gap', from, to, count: to - from + 1 })
        }
      }
      return items
    }

    function buildLayout(graph, expanded, expandAll, mainlineId, extraForkTurns) {
      const sessions = graph.sessions || {}
      const order = graph.order || Object.keys(sessions)
      const children = new Map()
      for (const id of order) children.set(id, [])
      for (const id of order) {
        const session = sessions[id]
        if (!session || !session.parentId || !sessions[session.parentId]) continue
        if (!children.has(session.parentId)) children.set(session.parentId, [])
        children.get(session.parentId).push(id)
      }
      const rootId = sessions[graph.root]
        ? graph.root
        : order.find((id) => sessions[id] && !sessions[id].parentId) || order[0]

      const forkIndexBySession = new Map()
      const parentForkTurns = new Map()
      for (const id of order) {
        const session = sessions[id]
        if (!session || !session.parentId || !sessions[session.parentId]) continue
        const parent = sessions[session.parentId]
        const index = forkIndexIn(parent, session.forkSeq)
        if (index != null) {
          forkIndexBySession.set(id, index)
          if (!parentForkTurns.has(session.parentId)) parentForkTurns.set(session.parentId, new Set())
          parentForkTurns.get(session.parentId).add(index)
        }
      }

      if (extraForkTurns) {
        for (const [parentId, turns] of extraForkTurns) {
          if (!sessions[parentId]) continue
          if (!parentForkTurns.has(parentId)) parentForkTurns.set(parentId, new Set())
          for (const index of turns) parentForkTurns.get(parentId).add(index)
        }
      }

      const itemsBySession = new Map()
      for (const id of order) {
        if (!sessions[id]) continue
        itemsBySession.set(id, buildItems(sessions[id], parentForkTurns.get(id) || new Set(), expanded, expandAll))
      }

      const layoutSessions = new Map()
      const placed = new Set()
      let laneCursor = 0
      const visit = (id, lane) => {
        if (!sessions[id] || placed.has(id)) return
        placed.add(id)
        const session = sessions[id]
        const parent = session.parentId ? sessions[session.parentId] : null
        const parentLayout = parent ? layoutSessions.get(session.parentId) : null
        let startCol = 0
        if (parentLayout) {
          const forkIndex = forkIndexBySession.get(id)
          const items = parentLayout.items
          let anchorIndex = items.length - 1
          if (forkIndex != null) {
            const found = items.findIndex((item) => item.kind === 'turn' && item.index === forkIndex)
            if (found >= 0) anchorIndex = found
          }
          startCol = parentLayout.startCol + Math.max(0, anchorIndex) + 1
        }
        const items = (itemsBySession.get(id) || []).map((item, index) => ({ ...item, col: startCol + index }))
        layoutSessions.set(id, {
          id,
          session,
          lane,
          startCol,
          parentId: parent ? session.parentId : null,
          forkIndex: forkIndexBySession.get(id) ?? null,
          items,
        })
        for (const child of children.get(id) || []) {
          laneCursor += 1
          visit(child, laneCursor)
        }
      }
      if (rootId) visit(rootId, 0)

      const elements = []
      const turnElements = []
      const gaps = []
      for (const info of layoutSessions.values()) {
        info.items.forEach((item) => {
          const x = LEFT_PAD + info.lane * LANE_PITCH
          const y = TOP_PAD + item.col * ROW_PITCH
          const entry = { sessionId: info.id, info, item, x, y }
          elements.push(entry)
          if (item.kind === 'gap') gaps.push(entry)
          else turnElements.push(entry)
        })
      }
      const elementAt = new Map(elements.map((entry) => [`${entry.sessionId}:${entry.item.kind === 'turn' ? entry.item.index : `gap-${entry.item.from}`}`, entry]))
      const firstElement = new Map()
      for (const entry of elements) if (!firstElement.has(entry.sessionId)) firstElement.set(entry.sessionId, entry)

      const forkCounts = new Map()
      const forkLabels = new Map()
      for (const id of order) {
        const session = sessions[id]
        if (!session || !session.parentId) continue
        const index = forkIndexBySession.get(id)
        if (index == null) continue
        const key = `${session.parentId}:${index}`
        forkCounts.set(key, (forkCounts.get(key) || 0) + 1)
        if (!forkLabels.has(key)) forkLabels.set(key, [])
        forkLabels.get(key).push(session.label || session.title)
      }

      const branchIds = [...layoutSessions.keys()].filter((id) => id !== rootId).sort()
      const colorMap = new Map(branchIds.map((id, index) => [id, COLORS[index % COLORS.length]]))

      const edges = []
      for (const info of layoutSessions.values()) {
        if (!info.parentId) continue
        const parentInfo = layoutSessions.get(info.parentId)
        const childFirst = firstElement.get(info.id)
        if (!parentInfo || !childFirst) continue
        const index = info.forkIndex == null ? Math.max(0, parentInfo.session.turns.length - 1) : info.forkIndex
        const parentAnchor =
          elementAt.get(`${info.parentId}:${index}`) ||
          [...parentInfo.items].reverse().map((item) => elementAt.get(`${info.parentId}:${item.kind === 'turn' ? item.index : `gap-${item.from}`}`)).find(Boolean)
        if (!parentAnchor) continue
        const x1 = parentAnchor.x + NODE_W
        const y1 = parentAnchor.y + NODE_H / 2
        const x2 = childFirst.x
        const y2 = childFirst.y + NODE_H / 2
        const bend = Math.max(30, Math.abs(x2 - x1) / 2)
        edges.push({
          id: info.id,
          color: colorMap.get(info.id) || COLORS[0],
          active: false,
          d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`,
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
        })
      }

      const mainCursor = mainlineId && sessions[mainlineId] ? mainlineId : graph.current
      const activeSessions = new Set()
      const activeLimits = new Map()
      for (const start of [mainCursor, graph.current]) {
        let cursor = start
        let guard = 0
        while (cursor && sessions[cursor] && guard < 500) {
          activeSessions.add(cursor)
          cursor = sessions[cursor].parentId
          guard += 1
        }
      }
      for (const start of [mainCursor, graph.current]) {
        let child = start
        let guard = 0
        while (child && sessions[child] && sessions[child].parentId && guard < 500) {
          const childInfo = layoutSessions.get(child)
          const parentId = sessions[child].parentId
          if (childInfo && childInfo.forkIndex != null) {
            activeLimits.set(parentId, Math.max(activeLimits.get(parentId) ?? -1, childInfo.forkIndex))
          }
          child = parentId
          guard += 1
        }
      }
      for (const edge of edges) edge.active = activeSessions.has(edge.id)

      const links = []
      for (const info of layoutSessions.values()) {
        const railX = LEFT_PAD + info.lane * LANE_PITCH + NODE_W / 2
        const color = info.id === rootId ? 'var(--dsw-alias-border-l2, rgba(128,128,128,.5))' : colorMap.get(info.id) || COLORS[0]
        for (let i = 0; i < info.items.length - 1; i += 1) {
          const from = info.items[i]
          const to = info.items[i + 1]
          const fromInset = from.kind === 'turn' ? 0 : (NODE_H - 40) / 2
          const fromBottom = TOP_PAD + from.col * ROW_PITCH + fromInset + (from.kind === 'turn' ? NODE_H : 40)
          const toInset = to.kind === 'turn' ? 0 : (NODE_H - 40) / 2
          const toTop = TOP_PAD + to.col * ROW_PITCH + toInset
          if (toTop <= fromBottom) continue
          links.push({
            key: `${info.id}:${i}`,
            sessionId: info.id,
            d: `M${railX},${fromBottom} L${railX},${toTop}`,
            color,
            active: activeSessions.has(info.id),
          })
        }
      }

      let width = 600
      let height = 300
      for (const entry of elements) {
        width = Math.max(width, entry.x + NODE_W + 96)
        height = Math.max(height, entry.y + NODE_H + 90)
      }

      const collapsed = {}
      for (const info of layoutSessions.values()) {
        const count = info.items.filter((item) => item.kind === 'gap').reduce((sum, item) => sum + item.count, 0)
        if (count > 0) collapsed[info.id] = count
      }

      return {
        rootId,
        layoutSessions,
        elements,
        turnElements,
        gaps,
        edges,
        links,
        forkCounts,
        forkLabels,
        colorMap,
        activeSessions,
        activeLimits,
        collapsed,
        width,
        height,
      }
    }

    function nodeActive(layout, entry, currentId) {
      if (!layout.activeSessions.has(entry.sessionId)) return false
      if (entry.sessionId === currentId) return true
      const limit = layout.activeLimits.get(entry.sessionId)
      if (limit == null) return true
      if (entry.item.kind === 'turn') return entry.item.index <= limit
      return entry.item.from <= limit
    }

    const EMPTY_TREE_LAYOUT = { nodes: [], edges: [], width: 600, height: 300, byKey: new Map() }

    function treeElementKey(entry) {
      if (!entry || !entry.item) return ''
      return entry.item.kind === 'turn'
        ? `${entry.sessionId}:t${entry.item.index}`
        : `${entry.sessionId}:g${entry.item.from}`
    }

    /**
     * 把主链布局（layout.elements 的 turn / gap）整理成父子树。
     * 每个会话的首项接父会话的 forkIndex 项（找不到时退到包含该轮的折叠项或父会话末项），
     * 同会话其余项接前一项。返回 depth / parentKey / childKeys。
     */
    function buildTurnTree(layout) {
      const empty = { nodes: [], byKey: new Map(), rootKeys: [] }
      if (!layout || !Array.isArray(layout.elements) || layout.elements.length === 0) return empty
      const byKey = new Map()
      const bySession = new Map()
      const nodes = []
      for (const entry of layout.elements) {
        const key = treeElementKey(entry)
        if (!key || byKey.has(key)) continue
        const node = {
          key,
          sessionId: entry.sessionId,
          kind: entry.item.kind,
          index: entry.item.kind === 'turn' ? entry.item.index : entry.item.from,
          item: entry.item,
          entry,
          depth: 0,
          parentKey: null,
          childKeys: [],
        }
        nodes.push(node)
        byKey.set(key, node)
        if (!bySession.has(entry.sessionId)) bySession.set(entry.sessionId, [])
        bySession.get(entry.sessionId).push(node)
      }
      for (const node of nodes) {
        const siblings = bySession.get(node.sessionId) || []
        const position = siblings.indexOf(node)
        if (position > 0) {
          node.parentKey = siblings[position - 1].key
          continue
        }
        const info = node.entry.info
        if (!info || !info.parentId) continue
        const parentNodes = bySession.get(info.parentId) || []
        if (parentNodes.length === 0) continue
        let target = null
        if (info.forkIndex != null) {
          target = byKey.get(`${info.parentId}:t${info.forkIndex}`) || null
          if (!target) {
            target =
              parentNodes.find(
                (candidate) =>
                  candidate.kind === 'gap' &&
                  candidate.item.kind === 'gap' &&
                  candidate.item.from <= info.forkIndex &&
                  candidate.item.to >= info.forkIndex,
              ) || null
          }
        }
        if (!target) target = parentNodes[parentNodes.length - 1]
        node.parentKey = target.key
      }
      for (const node of nodes) {
        if (!node.parentKey) continue
        const parent = byKey.get(node.parentKey)
        if (parent) parent.childKeys.push(node.key)
        else node.parentKey = null
      }
      const rootKeys = nodes.filter((node) => !node.parentKey).map((node) => node.key)
      const seen = new Set()
      const queue = rootKeys.map((key) => [key, 0])
      let head = 0
      while (head < queue.length) {
        const [key, depth] = queue[head]
        head += 1
        const node = byKey.get(key)
        if (!node || seen.has(key)) continue
        seen.add(key)
        node.depth = depth
        for (const childKey of node.childKeys) queue.push([childKey, depth + 1])
      }
      for (const node of nodes) if (!seen.has(node.key)) node.depth = 0
      return { nodes, byKey, rootKeys }
    }

    /**
     * 竖向 tidy tree：后序决定 x；叶子 cursor += 264 + 24；
     * 单子继承子节点 x；多子取首末中点；y = depth * (72 + 40)。
     */
    function layoutTidyTree(tree) {
      if (!tree || !Array.isArray(tree.nodes) || tree.nodes.length === 0) return EMPTY_TREE_LAYOUT
      const byKey = tree.byKey instanceof Map ? tree.byKey : new Map(tree.nodes.map((node) => [node.key, node]))
      const placed = new Map()
      let cursor = 0
      const visit = (key, guard) => {
        if (guard > 4096) return null
        const node = byKey.get(key)
        if (!node) return null
        if (placed.has(key)) return placed.get(key)
        const children = (node.childKeys || []).map((childKey) => byKey.get(childKey)).filter(Boolean)
        let x = 0
        if (children.length === 0) {
          x = cursor
          cursor += TREE_NODE_W + TREE_GAP_X
        } else if (children.length === 1) {
          const only = visit(children[0].key, guard + 1)
          x = only ? only.x : cursor
        } else {
          const first = visit(children[0].key, guard + 1)
          const last = visit(children[children.length - 1].key, guard + 1)
          x = first && last ? (first.x + last.x) / 2 : cursor
        }
        const placedNode = {
          key: node.key,
          sessionId: node.sessionId,
          kind: node.kind,
          index: node.index,
          item: node.item,
          entry: node.entry,
          depth: node.depth,
          parentKey: node.parentKey,
          childKeys: (node.childKeys || []).slice(),
          x,
          y: node.depth * TREE_DEPTH_Y,
          width: TREE_NODE_W,
          height: TREE_NODE_H,
        }
        placed.set(key, placedNode)
        return placedNode
      }
      const rootKeys =
        Array.isArray(tree.rootKeys) && tree.rootKeys.length > 0
          ? tree.rootKeys
          : tree.nodes.filter((node) => !node.parentKey).map((node) => node.key)
      for (const key of rootKeys) visit(key, 0)
      for (const node of tree.nodes) if (!placed.has(node.key)) visit(node.key, 0)
      const nodes = [...placed.values()]
      const edges = []
      for (const node of nodes) {
        if (!node.parentKey) continue
        const parent = placed.get(node.parentKey)
        if (!parent) continue
        const x1 = parent.x + TREE_NODE_W / 2
        const y1 = parent.y + TREE_NODE_H
        const x2 = node.x + TREE_NODE_W / 2
        const y2 = node.y
        const bend = Math.max(24, (y2 - y1) / 2)
        edges.push({
          key: `${parent.key}->${node.key}`,
          fromKey: parent.key,
          toKey: node.key,
          d: `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`,
        })
      }
      let width = 600
      let height = 300
      for (const node of nodes) {
        width = Math.max(width, node.x + TREE_NODE_W + 96)
        height = Math.max(height, node.y + TREE_NODE_H + 90)
      }
      return { nodes, edges, width, height, byKey: placed }
    }

    function pendingDraftText(sessionId) {
      try {
        return window.localStorage.getItem(PENDING_PREFIX + sessionId)
      } catch {
        return null
      }
    }

    function PendingDraftHelper(props) {
      const sessionId = props.sessionId
      const inputActions = props.inputActions
      useEffect(() => {
        if (!sessionId || !inputActions || typeof inputActions.setDraft !== 'function') return
        const text = pendingDraftText(sessionId)
        if (!text) return
        try {
          window.localStorage.removeItem(PENDING_PREFIX + sessionId)
        } catch {
          // 清理失败时仍尝试预填，下一次挂载最多重复一次。
        }
        try {
          inputActions.setDraft(text)
          if (typeof inputActions.focus === 'function') inputActions.focus()
        } catch {
          // 预填失败时保留剪贴板兜底。
        }
      }, [sessionId, inputActions])
      return null
    }

    function BranchMapView(props) {
      const sessionId = props.sessionId
      const ctx = props.pluginCtx
      const [graph, setGraph] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const [dialog, setDialog] = useState(null)
      const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
      const [fitted, setFitted] = useState(false)
      const [expanded, setExpanded] = useState({})
      const [expandAll, setExpandAll] = useState(false)
      const [dragging, setDragging] = useState(false)
      const [size, setSize] = useState({ width: 0, height: 0 })
      const [walk, setWalk] = useState(() => {
        try {
          return window.localStorage.getItem(WALK_KEY) === '1'
        } catch {
          return false
        }
      })
      const [mode, setMode] = useState(() => {
        try {
          return window.localStorage.getItem(MODE_KEY) === 'tree' ? 'tree' : 'chain'
        } catch {
          return 'chain'
        }
      })
      const [cursor, setCursor] = useState(0)
      const [mainlinePrefs, setMainlinePrefs] = useState(() => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem('dsh-branch-map:mainline') || '{}')
          return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
          return {}
        }
      })
      const [showAllBranches, setShowAllBranches] = useState(false)
      const [expandedBranches, setExpandedBranches] = useState({})
      const [pinned, setPinned] = useState(false)
      const [showConclusions, setShowConclusions] = useState(true)
      const [showContextPreview, setShowContextPreview] = useState(false)
      const [hostDerive, setHostDerive] = useState(false)
      const [hostBuild, setHostBuild] = useState(0)
      const viewportRef = useRef(null)
      const bodyRef = useRef(null)
      const sideListRef = useRef(null)
      const graphRef = useRef(null)
      const viewRef = useRef(view)
      viewRef.current = view
      const dragRef = useRef(null)
      const walkRef = useRef(walk)
      walkRef.current = walk
      const cursorRef = useRef(cursor)
      cursorRef.current = cursor
      const wheelAccum = useRef(0)
      const centeredRef = useRef(-1)
      const centeredKeyRef = useRef('')
      const walkInitRef = useRef(false)
      const refreshingRef = useRef(false)
      const refreshSeqRef = useRef(0)
      const lastWheelStepRef = useRef(0)
      const modeRef = useRef(mode)
      modeRef.current = mode
      const camerasRef = useRef({ chain: null, tree: null })
      const treeFittedRef = useRef(false)

      const refresh = useCallback(async () => {
        if (!sessionId) return
        if (refreshingRef.current) return
        refreshingRef.current = true
        const seq = refreshSeqRef.current + 1
        refreshSeqRef.current = seq
        try {
          const data = await loadGraph(sessionId)
          if (refreshSeqRef.current !== seq) return
          graphRef.current = data
          setGraph(data)
          setError('')
        } catch (err) {
          if (refreshSeqRef.current === seq) setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (refreshSeqRef.current === seq) refreshingRef.current = false
        }
      }, [sessionId])

      useEffect(() => {
        setFitted(false)
        setGraph(null)
        setExpanded({})
        setExpandAll(false)
        setCursor(0)
        walkInitRef.current = false
        centeredRef.current = -1; centeredKeyRef.current = ''
        treeFittedRef.current = false
        camerasRef.current = { chain: null, tree: null }
        graphRef.current = null
        refresh()
        const timer = setInterval(() => {
          if (!document.hidden) refresh()
        }, 3500)
        return () => clearInterval(timer)
      }, [refresh])

      useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return undefined
        const update = () => setSize({ width: viewport.clientWidth, height: viewport.clientHeight })
        update()
        const observer = new ResizeObserver(update)
        observer.observe(viewport)
        return () => observer.disconnect()
      }, [])

      const mainlineId =
        graph && graph.sessions
          ? mainlinePrefs[graph.root] && graph.sessions[mainlinePrefs[graph.root]]
            ? mainlinePrefs[graph.root]
            : graph.current
          : null
      const assignMainline = useCallback(
        (targetId) => {
          if (!graph || !targetId) return
          const next = { ...mainlinePrefs, [graph.root]: targetId }
          setMainlinePrefs(next)
          try {
            window.localStorage.setItem('dsh-branch-map:mainline', JSON.stringify(next))
          } catch {
            // 本机偏好写入失败不影响当前视图
          }
        },
        [graph, mainlinePrefs],
      )
      const fullFork = useMemo(() => {
        const byKey = new Map()
        const turnsByParent = new Map()
        if (!graph || !graph.sessions) return { byKey, turnsByParent }
        for (const candidate of Object.values(graph.sessions)) {
          if (!candidate.parentId || !graph.sessions[candidate.parentId]) continue
          const parent = graph.sessions[candidate.parentId]
          const index = forkIndexIn(parent, candidate.forkSeq)
          if (index == null) continue
          const key = `${candidate.parentId}:${index}`
          if (!byKey.has(key)) byKey.set(key, { parentId: candidate.parentId, index, children: [] })
          byKey.get(key).children.push(candidate.sessionId)
          if (!turnsByParent.has(candidate.parentId)) turnsByParent.set(candidate.parentId, new Set())
          turnsByParent.get(candidate.parentId).add(index)
        }
        return { byKey, turnsByParent }
      }, [graph])

      const visibleGraph = useMemo(() => {
        if (!graph || showAllBranches) return graph
        const sessions = graph.sessions || {}
        const keep = new Set()
        const addPath = (id) => {
          let currentId = id
          let guard = 0
          while (currentId && sessions[currentId] && guard < 500) {
            keep.add(currentId)
            currentId = sessions[currentId].parentId
            guard += 1
          }
        }
        addPath(mainlineId || graph.current)
        addPath(graph.current)
        for (const id of Object.keys(expandedBranches)) if (expandedBranches[id]) addPath(id)
        const nextSessions = {}
        for (const [id, value] of Object.entries(sessions)) if (keep.has(id)) nextSessions[id] = value
        return {
          ...graph,
          sessions: nextSessions,
          order: (graph.order || []).filter((id) => keep.has(id)),
        }
      }, [graph, mainlineId, expandedBranches, showAllBranches])

      const layout = useMemo(
        () => (visibleGraph ? buildLayout(visibleGraph, expanded, expandAll, mainlineId, fullFork.turnsByParent) : null),
        [visibleGraph, expanded, expandAll, mainlineId, fullFork],
      )
      const tree = useMemo(() => (mode === 'tree' && layout ? buildTurnTree(layout) : null), [mode, layout])
      const treeLayout = useMemo(() => (tree ? layoutTidyTree(tree) : EMPTY_TREE_LAYOUT), [tree])
      const current = graph && graph.sessions ? graph.sessions[graph.current] : null
      const currentTurns = current ? current.turns : []
      const turnsRef = useRef(currentTurns)
      turnsRef.current = currentTurns

      const summaryMap = useMemo(() => {
        const map = new Map()
        if (!graph || !graph.sessions) return map
        for (const entrySession of Object.values(graph.sessions)) {
          for (let index = 0; index < (entrySession.turns?.length ?? 0); index += 1) {
            const turn = entrySession.turns[index]
            map.set(`${entrySession.sessionId}:${index}`, {
              user: summarizeUser(turn.userText),
              assistant: summarizeAssistant(turn.assistantText, turn.steps),
            })
          }
        }
        return map
      }, [graph])
      const summarized = (sessionIdValue, index) =>
        summaryMap.get(`${sessionIdValue}:${index}`) || {
          user: summarizeUser(''),
          assistant: summarizeAssistant('', 0),
        }

      const contextPreview = useMemo(() => {
        if (!graph || !graph.sessions) return { sections: [], total: 0 }
        const chain = []
        let currentId = graph.current
        let guard = 0
        while (currentId && graph.sessions[currentId] && guard < 500) {
          chain.unshift(currentId)
          currentId = graph.sessions[currentId].parentId
          guard += 1
        }
        let total = 0
        const sections = chain.map((id, index) => {
          const entry = graph.sessions[id]
          const nextId = chain[index + 1]
          const forkSeq = nextId ? graph.sessions[nextId]?.forkSeq : null
          let turns = entry?.turns ?? []
          if (Number.isFinite(forkSeq)) {
            turns = turns.filter((turn) => typeof turn.userSeq !== 'number' || turn.userSeq <= forkSeq)
          }
          total += turns.length
          return { id, title: entry?.title || clip(id, 20), turns, hiddenCount: entry?.hiddenCount || 0 }
        })
        return { sections, total }
      }, [graph])

      const childConclusions = useMemo(() => {
        if (!graph || !graph.sessions) return []
        return Object.values(graph.sessions).filter(
          (entry) => entry.parentId === graph.current && typeof entry.conclusion?.text === 'string',
        )
      }, [graph])

      function buildMergeText() {
        if (!childConclusions.length) return ''
        const lines = childConclusions.map(
          (entry) => `- 分支「${entry.label || entry.title}」：${entry.conclusion.text}`,
        )
        return `分支结论汇总：\n${lines.join('\n')}\n\n请基于以上结论继续。`
      }

      function fillDraft(text) {
        try {
          if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
            props.inputActions.setDraft(text)
            return true
          }
        } catch {
          // 退回到 pending draft
        }
        try {
          window.localStorage.setItem(PENDING_PREFIX + graph.current, text)
          if (typeof props.openView === 'function') props.openView('chat', '')
          return false
        } catch {
          return false
        }
      }

      function exportContextMarkdown() {
        if (!graph) return
        const lines = ['# 分支图 · 当前路径', '']
        for (const section of contextPreview.sections) {
          lines.push(`## ${section.title}`)
          section.turns.forEach((turn, index) => {
            const info = summarized(section.id, index)
            lines.push(`- #${index + 1} [${info.assistant.tag}] ${info.assistant.summary}`)
            lines.push(`  - 你：${info.user.summary}`)
          })
          if (section.hiddenCount > 0) lines.push(`- （显示中隐藏了 ${section.hiddenCount} 轮）`)
          lines.push('')
        }
        try {
          const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `branch-map-context-${graph.current}.md`
          anchor.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {
          setError('导出失败：当前环境不支持下载')
        }
      }

      function hideTurn(sessionIdValue, userSeq) {
        if (typeof userSeq !== 'number') return
        const map = readHiddenMap()
        const list = Array.isArray(map[sessionIdValue]) ? map[sessionIdValue] : []
        if (!list.includes(userSeq)) list.push(userSeq)
        map[sessionIdValue] = list
        writeHiddenMap(map)
        refresh()
      }

      function restoreHidden(sessionIdValue) {
        const map = readHiddenMap()
        if (map[sessionIdValue]) {
          delete map[sessionIdValue]
          writeHiddenMap(map)
          refresh()
        }
      }

      async function openDerivePreview() {
        if (!graph || busy) return
        const hidden = Array.isArray(graph.sessions?.[graph.current]?.hiddenSeqs)
          ? graph.sessions[graph.current].hiddenSeqs
          : []
        if (hidden.length === 0) {
          setError('当前会话没有隐藏轮次可删除')
          return
        }
        setBusy(true)
        try {
          const preview = await callHost({
            action: 'derive-session',
            sessionId: graph.current,
            dropSeqs: hidden,
            dryRun: true,
          })
          setDialog({ kind: 'derive', sessionId: graph.current, dropSeqs: hidden, preview })
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      async function createDerivedSession() {
        if (!dialog || dialog.kind !== 'derive' || busy) return
        setBusy(true)
        try {
          const result = await callHost({
            action: 'derive-session',
            sessionId: dialog.sessionId,
            dropSeqs: dialog.dropSeqs,
            dryRun: false,
          })
          setDialog(null)
          await refresh()
          if (result?.sessionId) openSession(result.sessionId)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      const conclusionChips = useMemo(() => {
        if (!graph || !graph.sessions) return []
        const items = []
        for (const entrySession of Object.values(graph.sessions)) {
          if (entrySession.conclusion?.text) {
            items.push({
              id: `branch:${entrySession.sessionId}`,
              label: entrySession.label || entrySession.title,
              text: entrySession.conclusion.text,
              sessionId: entrySession.sessionId,
              index: null,
            })
          }
        }
        const currentSession = graph.sessions[graph.current]
        for (let index = 0; index < (currentSession?.turns?.length ?? 0); index += 1) {
          const info = summaryMap.get(`${graph.current}:${index}`)
          if (info?.assistant.kind === 'conclusion') {
            items.push({
              id: `turn:${graph.current}:${index}`,
              label: `第 ${index + 1} 轮`,
              text: info.assistant.summary,
              sessionId: graph.current,
              index,
            })
          }
        }
        return items.slice(0, 8)
      }, [graph, summaryMap])

      useEffect(() => {
        let active = true
        callHost({ action: 'health' })
          .then((result) => {
            if (!active) return
            setHostBuild(Number(result?.build) || 0)
            setHostDerive(Boolean(result?.canDeriveSession))
          })
          .catch(() => {
            if (active) setHostDerive(false)
          })
        return () => {
          active = false
        }
      }, [])

      const walkStep = useCallback((direction) => {
        const total = turnsRef.current.length
        if (!total) return
        setCursor((prev) => Math.max(0, Math.min(total - 1, prev + direction)))
      }, [])

      useEffect(() => {
        if (currentTurns.length === 0) {
          if (cursorRef.current !== 0) setCursor(0)
          return
        }
        const max = currentTurns.length - 1
        if (cursorRef.current > max) setCursor(max)
      }, [currentTurns.length])

      useEffect(() => {
        if (mode !== 'chain') return
        if (!walk || !graph) return
        if (!walkInitRef.current && currentTurns.length > 0) {
          walkInitRef.current = true
          setCursor(currentTurns.length - 1)
          centeredRef.current = -1; centeredKeyRef.current = ''
        }
      }, [walk, graph, currentTurns.length])

      useEffect(() => {
        if (mode !== 'chain') return
        if (!walk || !layout || !graph) return
        if (pinned) return
        const sessionTurns = graph.sessions[graph.current]?.turns ?? []
        if (!sessionTurns.length) return
        const index = Math.max(0, Math.min(sessionTurns.length - 1, cursorRef.current))
        if (index !== cursorRef.current) {
          setCursor(index)
          return
        }
        const entry = layout.turnElements.find((candidate) => candidate.sessionId === graph.current && candidate.item.index === index)
        if (!entry) {
          const gap = layout.gaps.find(
            (candidate) => candidate.sessionId === graph.current && candidate.item.from <= index && candidate.item.to >= index,
          )
          if (gap) {
            const key = `${graph.current}:${gap.item.from}`
            setExpanded((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
          }
          return
        }
        const viewport = viewportRef.current
        if (!viewport || !viewport.clientWidth) return
        const zoom = Math.max(0.72, Math.min(1.3, viewRef.current.zoom || 1))
        const centerKey = `${index}:${layout.width}x${layout.height}:${viewport.clientWidth}x${viewport.clientHeight}:${Math.round(zoom * 100)}`
        if (centeredKeyRef.current === centerKey) return
        centeredKeyRef.current = centerKey
        setView({
          zoom,
          x: viewport.clientWidth / 2 - (entry.x + NODE_W / 2) * zoom,
          y: viewport.clientHeight * 0.5 - (entry.y + NODE_H / 2) * zoom,
        })
      }, [walk, cursor, layout, graph, size.width, size.height, view.zoom, pinned, mode])

      useEffect(() => {
        if (!walk) return
        if (pinned) return
        const list = sideListRef.current
        if (!list) return
        const row = list.querySelector('[data-current="true"]')
        if (!row) return
        const listRect = list.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const delta = rowRect.top - listRect.top
        if (Math.abs(delta - 10) > 2) list.scrollTop += delta - 10
      }, [walk, cursor, graph, layout, pinned])

      useEffect(() => {
        if (!dialog) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setDialog(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [dialog])

      useEffect(() => {
        const onKey = (event) => {
          if (!walkRef.current) return
          const target = event.target
          if (
            target &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              target.isContentEditable)
          ) {
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            walkStep(event.key === 'ArrowDown' ? 1 : -1)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [walkStep])

      useEffect(() => {
        const body = bodyRef.current
        if (!body) return undefined
        const onWheel = (event) => {
          if (modeRef.current === 'tree') {
            const treeViewport = viewportRef.current
            if (!treeViewport || !treeViewport.contains(event.target)) return
            if (event.target && event.target.closest && event.target.closest('.bm-side-detailbox')) return
            event.preventDefault()
            if (event.metaKey || event.ctrlKey) {
              const rect = treeViewport.getBoundingClientRect()
              const px = event.clientX - rect.left
              const py = event.clientY - rect.top
              setView((prev) => {
                const zoom = Math.max(0.25, Math.min(2.2, prev.zoom * Math.exp(-event.deltaY * 0.0015)))
                return {
                  zoom,
                  x: px - ((px - prev.x) / prev.zoom) * zoom,
                  y: py - ((py - prev.y) / prev.zoom) * zoom,
                }
              })
              return
            }
            setView((prev) => ({ ...prev, x: prev.x - event.deltaX, y: prev.y - event.deltaY }))
            return
          }
          if (walkRef.current) {
            if (event.target && event.target.closest && event.target.closest('.bm-side-detailbox')) return
            event.preventDefault()
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
            if (now - lastWheelStepRef.current < 140) return
            wheelAccum.current += event.deltaY
            if (Math.abs(wheelAccum.current) < 24) return
            const direction = wheelAccum.current > 0 ? 1 : -1
            wheelAccum.current = 0
            lastWheelStepRef.current = now
            walkStep(direction)
            return
          }
          const viewport = viewportRef.current
          if (!viewport || !viewport.contains(event.target)) return
          event.preventDefault()
          const rect = viewport.getBoundingClientRect()
          const px = event.clientX - rect.left
          const py = event.clientY - rect.top
          setView((prev) => {
            const zoom = Math.max(0.25, Math.min(2.2, prev.zoom * Math.exp(-event.deltaY * 0.0015)))
            return {
              zoom,
              x: px - ((px - prev.x) / prev.zoom) * zoom,
              y: py - ((py - prev.y) / prev.zoom) * zoom,
            }
          })
        }
        body.addEventListener('wheel', onWheel, { passive: false })
        return () => body.removeEventListener('wheel', onWheel)
      }, [walkStep])

      const zoomToFit = useCallback(() => {
        const viewport = viewportRef.current
        if (!visibleGraph || !viewport) return
        const nextLayout = buildLayout(visibleGraph, expanded, expandAll, mainlineId, fullFork.turnsByParent)
        const width = viewport.clientWidth
        const height = viewport.clientHeight
        if (!width || !height) return
        const zoom = Math.max(0.3, Math.min(1.1, Math.min((width - 70) / nextLayout.width, (height - 70) / nextLayout.height)))
        setView({
          zoom,
          x: Math.max(16, (width - nextLayout.width * zoom) / 2),
          y: Math.max(16, (height - nextLayout.height * zoom) / 2),
        })
        setFitted(true)
      }, [expanded, expandAll, mainlineId, visibleGraph, fullFork])

      const treeZoomToFit = useCallback(() => {
        const viewport = viewportRef.current
        if (!treeLayout || treeLayout.nodes.length === 0) return
        const width = viewport ? viewport.clientWidth : 0
        const height = viewport ? viewport.clientHeight : 0
        if (!width || !height) return
        const zoom = Math.max(0.3, Math.min(1.1, Math.min((width - 70) / treeLayout.width, (height - 70) / treeLayout.height)))
        setView({
          zoom,
          x: Math.max(16, (width - treeLayout.width * zoom) / 2),
          y: Math.max(16, (height - treeLayout.height * zoom) / 2),
        })
        treeFittedRef.current = true
      }, [treeLayout])

      const treeFocusCurrent = useCallback(() => {
        const viewport = viewportRef.current
        if (!viewport || !treeLayout || !graph) return
        const ofCurrent = treeLayout.nodes.filter((node) => node.sessionId === graph.current)
        const node = ofCurrent[ofCurrent.length - 1] || treeLayout.nodes[0]
        if (!node) return
        const zoom = Math.max(0.5, Math.min(viewRef.current.zoom || 1, 1.2))
        setView({
          zoom,
          x: viewport.clientWidth / 2 - (node.x + TREE_NODE_W / 2) * zoom,
          y: viewport.clientHeight * 0.5 - (node.y + TREE_NODE_H / 2) * zoom,
        })
      }, [treeLayout, graph])

      useEffect(() => {
        if (layout && !fitted && size.width > 0 && !walk) zoomToFit()
      }, [layout, fitted, size.width, walk, zoomToFit])

      useEffect(() => {
        if (mode !== 'tree') return
        if (!tree || treeLayout.nodes.length === 0) return
        if (treeFittedRef.current) return
        if (size.width > 0) treeZoomToFit()
      }, [mode, tree, treeLayout, size.width, treeZoomToFit])

      const focusCurrent = useCallback(() => {
        const viewport = viewportRef.current
        if (!viewport || !visibleGraph) return
        const nextLayout = buildLayout(visibleGraph, expanded, expandAll, mainlineId, fullFork.turnsByParent)
        const currentInfo = nextLayout.layoutSessions.get(visibleGraph.current)
        if (!currentInfo) return
        const last = [...currentInfo.items].reverse().find((item) => item.kind === 'turn') || currentInfo.items[currentInfo.items.length - 1]
        if (!last) return
        const worldX = LEFT_PAD + currentInfo.lane * LANE_PITCH + NODE_W / 2
        const worldY = TOP_PAD + last.col * ROW_PITCH + NODE_H / 2
        const zoom = Math.max(0.55, Math.min(viewRef.current.zoom || 1, 1.4))
        setView({
          zoom,
          x: viewport.clientWidth / 2 - worldX * zoom,
          y: viewport.clientHeight * 0.58 - worldY * zoom,
        })
      }, [expanded, expandAll, mainlineId, visibleGraph, fullFork])

      function toggleWalk() {
        const next = !walk
        try {
          window.localStorage.setItem(WALK_KEY, next ? '1' : '0')
        } catch {
          // 偏好写入失败不影响本次切换。
        }
        setWalk(next)
        centeredRef.current = -1; centeredKeyRef.current = ''
        walkInitRef.current = false
        if (next) {
          setCursor(Math.max(0, currentTurns.length - 1))
        }
      }

      function switchMode(next) {
        if (next !== 'chain' && next !== 'tree') return
        if (next === modeRef.current) return
        camerasRef.current[modeRef.current] = viewRef.current
        const saved = camerasRef.current[next]
        modeRef.current = next
        setMode(next)
        try {
          window.localStorage.setItem(MODE_KEY, next)
        } catch {
          // 本机偏好写入失败不影响本次切换
        }
        if (next === 'chain') {
          centeredRef.current = -1
          centeredKeyRef.current = ''
        }
        if (saved && typeof saved.zoom === 'number') {
          setView(saved)
          if (next === 'tree') treeFittedRef.current = true
        } else if (next === 'chain') {
          setFitted(false)
          setView({ x: 0, y: 0, zoom: 1 })
        } else {
          treeFittedRef.current = false
        }
      }

      function enterWalkAt(index) {
        if (typeof index !== 'number') return
        if (!walk) {
          walkInitRef.current = true
          setWalk(true)
          try {
            window.localStorage.setItem(WALK_KEY, '1')
          } catch {
            // 忽略
          }
        }
        setCursor(index)
        centeredRef.current = -1
        centeredKeyRef.current = ''
      }

      function activateTreeNode(node) {
        if (!node || !graph) return
        if (node.kind === 'gap') {
          setExpanded((prev) => ({ ...prev, [`${node.sessionId}:${node.item.from}`]: true }))
          return
        }
        if (node.sessionId !== graph.current) {
          openSession(node.sessionId)
          return
        }
        enterWalkAt(node.index)
      }

      function openSession(id) {
        if (!id || id === sessionId) return
        try {
          ctx.uiWorkspace.openSession(id)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }

      function startFork(entry) {
        if (!entry || entry.item.kind !== 'turn') return
        const turn = entry.item.turn
        if (turn.assistantSeq == null && turn.userSeq == null) {
          setError('这一轮没有可用于分叉的事件序号')
          return
        }
        const info = layout.layoutSessions.get(entry.sessionId)
        const childCount = (layout.forkCounts.get(`${entry.sessionId}:${entry.item.index}`) || 0) + 1
        setDialog({
          kind: 'fork',
          sessionId: entry.sessionId,
          sessionTitle: info?.session?.title || entry.sessionId,
          seq: turn.assistantSeq ?? turn.userSeq,
          label: `分支 ${childCount}`,
          text: '',
        })
      }

      function startConclusion(info) {
        const session = info.session
        const lastTurn = [...(session.turns || [])].reverse().find((turn) => turn.assistantText)
        setDialog({
          kind: 'conclusion',
          sessionId: session.sessionId,
          sessionTitle: session.title,
          parentId: session.parentId,
          label: session.label || '',
          text: session.conclusion?.text || lastTurn?.assistantText || '',
        })
      }

      async function submitFork() {
        if (!dialog || busy) return
        setBusy(true)
        try {
          const childId = await ctx.sessions.fork({
            sessionId: dialog.sessionId,
            atSeq: dialog.seq,
            increaseTitle: false,
          })
          await callHost({
            action: 'set-meta',
            sessionId: childId,
            parentId: dialog.sessionId,
            forkSeq: dialog.seq,
            label: dialog.label || '分支',
          })
          const registry = readBranchRegistry()
          registry[childId] = {
            parentId: dialog.sessionId,
            forkSeq: dialog.seq,
            label: dialog.label || '分支',
            createdAt: Date.now(),
          }
          writeBranchRegistry(registry)
          setDialog(null)
          await refresh()
          openSession(childId)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      async function submitConclusion(returnToParent) {
        if (!dialog || busy) return
        const text = String(dialog.text || '').trim()
        if (!text) {
          setError('结论不能为空')
          return
        }
        setBusy(true)
        try {
          await callHost({ action: 'save-conclusion', sessionId: dialog.sessionId, text })
          if (returnToParent && dialog.parentId) {
            await callHost({ action: 'mark-returned', sessionId: dialog.sessionId })
            const message = `分支「${dialog.label || dialog.sessionTitle}」结论：${text}\n\n请在此基础上继续。`
            try {
              window.localStorage.setItem(PENDING_PREFIX + dialog.parentId, message)
            } catch {
              // localStorage 不可用时只依赖剪贴板。
            }
            try {
              await navigator.clipboard?.writeText?.(message)
            } catch {
              // 剪贴板权限失败不阻断跳转。
            }
            if (dialog.parentId === graph.current) {
              fillDraft(message)
              setDialog(null)
              return
            }
            setDialog(null)
            openSession(dialog.parentId)
            return
          }
          setDialog(null)
          await refresh()
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      function onPointerDown(event) {
        if (event.button !== 0) return
        if (event.target.closest('.bm-node, .bm-gap, .bm-lane, .bm-tn, .bm-inspector, .bm-dialog, .bm-zoom, button, textarea, input')) return
        const viewport = viewportRef.current
        if (!viewport) return
        viewport.setPointerCapture(event.pointerId)
        dragRef.current = { x: event.clientX, y: event.clientY, vx: viewRef.current.x, vy: viewRef.current.y }
        setDragging(true)
      }

      function onPointerMove(event) {
        const drag = dragRef.current
        if (!drag) return
        setView((prev) => ({ ...prev, x: drag.vx + event.clientX - drag.x, y: drag.vy + event.clientY - drag.y }))
      }

      function onPointerUp(event) {
        const viewport = viewportRef.current
        if (viewport && viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
        dragRef.current = null
        setDragging(false)
      }

      const worldBounds = useMemo(() => {
        if (!size.width || !size.height) return null
        const left = (-view.x - 320) / view.zoom
        const top = (-view.y - 320) / view.zoom
        const right = (size.width - view.x + 320) / view.zoom
        const bottom = (size.height - view.y + 320) / view.zoom
        return { left, top, right, bottom }
      }, [view, size])

      function inView(layoutEntry, width = NODE_W, height = NODE_H) {
        if (!worldBounds) return true
        return (
          layoutEntry.x + width >= worldBounds.left &&
          layoutEntry.x <= worldBounds.right &&
          layoutEntry.y + height >= worldBounds.top &&
          layoutEntry.y <= worldBounds.bottom
        )
      }

      const visibleNodes = []
      const visibleGaps = []
      if (layout && worldBounds) {
        for (const entry of layout.turnElements) {
          if (inView(entry)) visibleNodes.push(entry)
        }
        for (const entry of layout.gaps) {
          if (inView(entry, 120, 44)) visibleGaps.push(entry)
        }
      } else if (layout) {
        for (const entry of layout.turnElements) {
          visibleNodes.push(entry)
        }
        for (const entry of layout.gaps) {
          visibleGaps.push(entry)
        }
      }
      const lod = view.zoom < 0.6
      const branchCount = graph ? Math.max(0, (graph.order || []).length - 1) : 0
      const totalTurns = currentTurns.length
      const isWalking = walk
      const selectedTurn = isWalking ? currentTurns[cursorRef.current] : null
      const selectedInfo = isWalking && selectedTurn ? summarized(graph.current, cursorRef.current) : null

      function activateEntry(entry) {
        if (entry.sessionId !== graph.current) {
          openSession(entry.sessionId)
          return
        }
        if (!walk) {
          walkInitRef.current = true
          setWalk(true)
          try {
            window.localStorage.setItem(WALK_KEY, '1')
          } catch {
            // 忽略
          }
        }
        setCursor(entry.item.index)
        centeredRef.current = -1; centeredKeyRef.current = ''
      }

      const nodeElements = visibleNodes.map((entry) => {
        const turn = entry.item.turn
        const info = summarized(entry.sessionId, entry.item.index)
        const forkInfo = fullFork.byKey.get(`${entry.sessionId}:${entry.item.index}`)
        const children = forkInfo ? forkInfo.children : []
        const branchesShown = children.some((id) => expandedBranches[id] || (visibleGraph.sessions[id] && (layout.activeSessions.has(id) || id === graph.current)))
        const active = nodeActive(layout, entry, mainlineId || graph.current)
        const classes = ['bm-node']
        if (entry.sessionId === graph.current) classes.push('bm-current')
        if (active) classes.push('bm-active')
        else classes.push('bm-dim')
        if (lod) classes.push('bm-lod')
        if (isWalking && entry.sessionId === graph.current && entry.item.index === cursorRef.current) classes.push('bm-selected')
        const color = entry.sessionId === layout.rootId ? COLORS[0] : layout.colorMap.get(entry.sessionId) || COLORS[0]
        const kind = info.assistant.kind
        return h(
          'div',
          {
            key: `${entry.sessionId}:${entry.item.index}`,
            className: classes.join(' '),
            style: { left: entry.x, top: entry.y, borderLeftColor: color },
            title: `第 ${entry.item.index + 1} 轮 · ${info.assistant.tag}：${info.assistant.summary}\n${info.user.tag}：${info.user.summary}`,
            role: 'button',
            tabIndex: 0,
            'aria-label': `第 ${entry.item.index + 1} 轮，${info.assistant.tag}：${info.assistant.summary}`,
            onClick: () => activateEntry(entry),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                activateEntry(entry)
              }
            },
          },
          h(
            'div',
            { className: 'bm-node-head' },
            h('span', { className: `bm-kind bm-kind-${kind}` }, info.assistant.tag),
            children.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: `bm-branch-chip${branchesShown ? ' bm-branch-chip-on' : ''}`,
                    title: `这轮有 ${children.length} 个分支，点击${branchesShown ? '收起' : '展开'}`,
                    'aria-label': `这轮有 ${children.length} 个分支，${branchesShown ? '收起' : '展开'}`,
                    onClick: (event) => {
                      event.stopPropagation()
                      setShowAllBranches(false)
                      setExpandedBranches((prev) => {
                        const next = { ...prev }
                        const any = children.some((id) => next[id])
                        for (const id of children) {
                          if (any) delete next[id]
                          else next[id] = true
                        }
                        return next
                      })
                    },
                  },
                  `⑂${children.length}`,
                )
              : null,
            h('span', { className: 'bm-node-idx' }, `#${entry.item.index + 1}`),
            h(
              'button',
              {
                type: 'button',
                className: 'bm-fork',
                title: '从这一轮开分支',
                'aria-label': '从这一轮开分支',
                onClick: (event) => {
                  event.stopPropagation()
                  startFork(entry)
                },
              },
              '＋',
            ),
          ),
          h('div', { className: 'bm-node-summary' }, info.assistant.summary),
          h(
            'div',
            { className: 'bm-node-user' },
            h('span', { className: `bm-user-tag${info.user.kind === 'decision' ? ' bm-user-tag-decision' : ''}` }, info.user.tag),
            h('span', { className: 'bm-user-text' }, info.user.summary),
          ),
        )
      })

      const gapElements = visibleGaps.map((entry) =>
        h(
          'button',
          {
            key: `${entry.sessionId}:gap:${entry.item.from}`,
            type: 'button',
            className: 'bm-gap',
            style: { left: entry.x + (NODE_W - 112) / 2, top: entry.y + (NODE_H - 40) / 2 },
            title: `第 ${entry.item.from + 1}–${entry.item.to + 1} 轮，点击展开`,
            onClick: (event) => {
              event.stopPropagation()
              setExpanded((prev) => ({ ...prev, [`${entry.sessionId}:${entry.item.from}`]: true }))
            },
          },
          h('span', null, '…'),
          h('span', null, `${entry.item.count} 轮`),
          h('span', { style: { opacity: 0.7 } }, '展开'),
        ),
      )

      const treeLod = view.zoom >= 0.8 ? 'full' : view.zoom >= 0.5 ? 'compact' : 'dot'
      const treeNodes =
        mode === 'tree' && layout
          ? treeLayout.nodes.map((node) => {
              const isGap = node.kind === 'gap'
              const info = isGap ? null : summarized(node.sessionId, node.index)
              const forkInfo = isGap ? null : fullFork.byKey.get(`${node.sessionId}:${node.index}`)
              const children = forkInfo ? forkInfo.children : []
              const branchesShown = children.some(
                (id) =>
                  expandedBranches[id] ||
                  (visibleGraph && visibleGraph.sessions && visibleGraph.sessions[id] && (layout.activeSessions.has(id) || id === graph.current)),
              )
              const active = nodeActive(layout, node.entry, mainlineId || graph.current)
              const classes = ['bm-tn', `bm-tn-${treeLod}`]
              if (node.sessionId === graph.current) classes.push('bm-tn-current')
              if (active) classes.push('bm-tn-path')
              else classes.push('bm-tn-side')
              if (walk && node.sessionId === graph.current && !isGap && node.index === cursorRef.current) classes.push('bm-tn-selected')
              if (isGap) classes.push('bm-tn-gap')
              const color = node.sessionId === layout.rootId ? COLORS[0] : layout.colorMap.get(node.sessionId) || COLORS[0]
              const title = isGap ? `折叠 ${node.item.count} 轮` : info.assistant.summary
              const sub = isGap ? '点击展开' : `${info.user.tag}：${info.user.summary}`
              return h(
                'div',
                {
                  key: `tn:${node.key}`,
                  'data-key': node.key,
                  className: classes.join(' '),
                  style: { left: node.x, top: node.y, '--bm-tn-color': color },
                  title: isGap
                    ? `第 ${node.item.from + 1}–${node.item.to + 1} 轮，点击展开`
                    : `第 ${node.index + 1} 轮 · ${info.assistant.tag}：${info.assistant.summary}\n${info.user.tag}：${info.user.summary}（双击打开会话）`,
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': isGap
                    ? `折叠 ${node.item.count} 轮`
                    : `第 ${node.index + 1} 轮，${info.assistant.tag}：${info.assistant.summary}`,
                  onClick: () => activateTreeNode(node),
                  onDoubleClick: () => openSession(node.sessionId),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      openSession(node.sessionId)
                      return
                    }
                    if (event.key === ' ') {
                      event.preventDefault()
                      activateTreeNode(node)
                    }
                  },
                },
                h(
                  'div',
                  { className: 'bm-tn-head' },
                  isGap
                    ? h('span', { className: 'bm-tn-gap-tag' }, '折叠')
                    : h('span', { className: `bm-kind bm-kind-${info.assistant.kind}` }, info.assistant.tag),
                  children.length > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: `bm-branch-chip${branchesShown ? ' bm-branch-chip-on' : ''}`,
                          title: `这轮有 ${children.length} 个分支，点击${branchesShown ? '收起' : '展开'}`,
                          'aria-label': `这轮有 ${children.length} 个分支，${branchesShown ? '收起' : '展开'}`,
                          onClick: (event) => {
                            event.stopPropagation()
                            setShowAllBranches(false)
                            setExpandedBranches((prev) => {
                              const next = { ...prev }
                              const any = children.some((id) => next[id])
                              for (const id of children) {
                                if (any) delete next[id]
                                else next[id] = true
                              }
                              return next
                            })
                          },
                        },
                        `⑂${children.length}`,
                      )
                    : null,
                  h('span', { className: 'bm-tn-idx' }, isGap ? `…×${node.item.count}` : `#${node.index + 1}`),
                ),
                h('div', { className: 'bm-tn-title' }, title),
                h('div', { className: 'bm-tn-sub' }, sub),
                h('span', { className: 'bm-tn-dot-mark', 'aria-hidden': 'true' }),
              )
            })
          : []
      const treeEdges =
        mode === 'tree' && layout
          ? treeLayout.edges.map((edge) => {
              const target = treeLayout.byKey.get(edge.toKey)
              const active = target ? nodeActive(layout, target.entry, mainlineId || graph.current) : false
              const color = target
                ? target.sessionId === layout.rootId
                  ? COLORS[0]
                  : layout.colorMap.get(target.sessionId) || COLORS[0]
                : COLORS[0]
              return { ...edge, active, color }
            })
          : []
      const laneElements = layout
        ? [...layout.layoutSessions.values()].map((info) => {
            const first = info.items.find((item) => item.kind === 'turn') || info.items[0]
            if (!first) return null
            const x = LEFT_PAD + info.lane * LANE_PITCH
            const y = TOP_PAD + first.col * ROW_PITCH - 50
            const isRoot = info.id === layout.rootId
            const active = layout.activeSessions.has(info.id)
            const isCurrentLane = info.id === graph.current
            const color = isRoot ? COLORS[0] : layout.colorMap.get(info.id) || COLORS[0]
            const folded = layout.collapsed[info.id] || 0
            return h(
              'div',
              {
                key: `lane:${info.id}`,
                className: `bm-lane${active ? '' : ' bm-dim'}${isCurrentLane ? ' bm-lane-current' : ''}`,
                style: { left: x, top: y },
                title: `${info.session.title}（点击打开会话）`,
                onClick: () => openSession(info.id),
              },
              h('span', { className: 'bm-dot', style: { background: color } }),
              h('span', { className: 'bm-lane-name' }, isRoot ? '主线' : info.session.label || info.session.title),
              active && !isRoot ? h('span', { className: 'bm-lane-main' }, '主线') : null,
              h(
                'span',
                { className: 'bm-lane-meta' },
                `${info.session.turns.length} 轮 · ${statusLabel(info.session.status)}${folded ? ` · 折叠 ${folded} 轮` : ''}`,
              ),
              h(
                'span',
                { className: 'bm-lane-actions' },
                !isRoot
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'bm-lane-btn',
                        title: '记录这条分支的结论',
                        onClick: (event) => {
                          event.stopPropagation()
                          startConclusion(info)
                        },
                      },
                      '结论',
                    )
                  : null,
                !isRoot && info.session.conclusion
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'bm-lane-btn',
                        title: '带结论回到父会话',
                        onClick: (event) => {
                          event.stopPropagation()
                          startConclusion(info)
                        },
                      },
                      '回填',
                    )
                  : null,
                expandedBranches[info.id] && !active && !isCurrentLane
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'bm-lane-btn',
                        title: '收起这条分支',
                        onClick: (event) => {
                          event.stopPropagation()
                          setExpandedBranches((prev) => {
                            const next = { ...prev }
                            delete next[info.id]
                            return next
                          })
                        },
                      },
                      '收起',
                    )
                  : null,
                mainlineId !== info.id
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'bm-lane-btn',
                        title: '把这条分支设为主脉络',
                        onClick: (event) => {
                          event.stopPropagation()
                          assignMainline(info.id)
                        },
                      },
                      '设为主线',
                    )
                  : null,
              ),
            )
          })
        : []

      const inspector =
        isWalking && selectedTurn && selectedInfo
          ? h(
              'div',
              { className: 'bm-inspector', key: `inspector:${cursorRef.current}` },
              h(
                'div',
                { className: 'bm-insp-head' },
                h('span', { className: `bm-kind bm-kind-${selectedInfo.assistant.kind}` }, selectedInfo.assistant.tag),
                h('span', { className: 'bm-insp-title' }, `第 ${cursorRef.current + 1} / ${totalTurns} 轮`),
                selectedTurn.steps > 0 ? h('span', null, `${selectedTurn.steps} 步`) : null,
                h(
                  'button',
                  { type: 'button', className: 'bm-btn bm-insp-close', title: '退出逐轮浏览', onClick: toggleWalk },
                  '关闭',
                ),
              ),
              h('div', { className: 'bm-insp-body' }, selectedInfo.assistant.detail || selectedInfo.assistant.summary),
              h(
                'div',
                { className: 'bm-insp-user' },
                h('strong', null, `${selectedInfo.user.tag}：`),
                selectedInfo.user.detail || selectedInfo.user.summary,
              ),
              h(
                'div',
                { className: 'bm-insp-actions' },
                h('button', { type: 'button', className: 'bm-btn', onClick: () => walkStep(-1), disabled: cursorRef.current <= 0 }, '上一轮'),
                h('button', { type: 'button', className: 'bm-btn', onClick: () => walkStep(1), disabled: cursorRef.current >= totalTurns - 1 }, '下一轮'),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'bm-btn bm-btn-primary',
                    onClick: () =>
                      startFork({
                        sessionId: graph.current,
                        item: { kind: 'turn', index: cursorRef.current, turn: currentTurns[cursorRef.current] },
                      }),
                  },
                  '⑂ 从这一轮开分支',
                ),
              ),
            )
          : null

      return h(
        'section',
        { className: 'bm-root', 'aria-label': '分支图' },
        h(
          'div',
          { className: 'bm-toolbar' },
          h('span', { className: 'bm-title' }, '分支图'),
          h('span', { className: 'bm-sub' }, current ? `${current.title} · ${totalTurns} 轮` : sessionId || '未选择会话'),
          h('span', { className: 'bm-chip' }, `${branchCount} 个分支`),
          graph && graph.order && graph.order.length > 1 && !expandAll
            ? h('span', { className: 'bm-chip' }, '长对话已折叠，点「N 轮」展开')
            : null,
          h(
            'span',
            { className: 'bm-seg', role: 'group', 'aria-label': '视图模式' },
            h(
              'button',
              {
                type: 'button',
                className: `bm-seg-btn${mode === 'chain' ? ' bm-seg-on' : ''}`,
                title: '主链视图：按轮次纵向浏览',
                'aria-pressed': mode === 'chain' ? 'true' : 'false',
                onClick: () => switchMode('chain'),
              },
              '主链',
            ),
            h(
              'button',
              {
                type: 'button',
                className: `bm-seg-btn${mode === 'tree' ? ' bm-seg-on' : ''}`,
                title: '树视图：按分叉层级浏览',
                'aria-pressed': mode === 'tree' ? 'true' : 'false',
                onClick: () => switchMode('tree'),
              },
              '树',
            ),
          ),
          h('span', { className: 'bm-spacer' }),
          mode === 'chain'
            ? h(
                'button',
                { type: 'button', className: `bm-btn${walk ? ' bm-btn-on' : ''}`, title: '切换滚轮行为：逐轮浏览 / 画布缩放', onClick: toggleWalk },
                walk ? '滚动：逐轮' : '滚动：缩放',
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: `bm-btn${showAllBranches ? ' bm-btn-on' : ''}`,
              title: '显示或隐藏非主线分支；默认把分叉收束成 ⑂N 药丸',
              onClick: () => setShowAllBranches((value) => !value),
            },
            showAllBranches ? '只看主线' : '显示全部分支',
          ),
          h(
            'button',
            {
              type: 'button',
              className: `bm-btn${pinned ? ' bm-btn-on' : ''}`,
              title: '跟随：选中轮次自动定位；钉住：停止自动定位，只手动平移',
              onClick: () => {
                if (pinned) {
                  centeredKeyRef.current = ''
                  centeredRef.current = -1
                }
                setPinned((value) => !value)
              },
            },
            pinned ? '已钉住' : '跟随中',
          ),
          conclusionChips.length > 0
            ? h(
                'button',
                {
                  type: 'button',
                  className: `bm-btn${showConclusions ? ' bm-btn-on' : ''}`,
                  title: '显示/隐藏关键结论条',
                  onClick: () => setShowConclusions((value) => !value),
                },
                `结论 ${conclusionChips.length}`,
              )
            : null,
          current && current.hiddenCount > 0
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'bm-btn',
                  title: '恢复本会话被隐藏的轮次',
                  onClick: () => restoreHidden(graph.current),
                },
                `恢复隐藏 ${current.hiddenCount}`,
              )
            : null,
          childConclusions.length > 0
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'bm-btn',
                  title: '把本会话各分支保存的结论汇总成一条消息，填入输入框',
                  onClick: () =>
                    setDialog({
                      kind: 'merge',
                      sessionId: graph.current,
                      sessionTitle: current ? current.title : '',
                      text: buildMergeText(),
                    }),
                },
                `汇总结论 ${childConclusions.length}`,
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: `bm-btn${showContextPreview ? ' bm-btn-on' : ''}`,
              title: '预览当前路径会进入下一次模型请求的轮次（按显示过滤，非真实日志）',
              onClick: () => setShowContextPreview((value) => !value),
            },
            `上下文 ${contextPreview.total}`,
          ),
          h('button', { type: 'button', className: 'bm-btn', onClick: refresh }, '刷新'),
          h('button', { type: 'button', className: 'bm-btn', onClick: mode === 'tree' ? treeFocusCurrent : focusCurrent }, '回到当前'),
          h(
            'button',
            {
              type: 'button',
              className: `bm-btn${expandAll ? ' bm-btn-on' : ''}`,
              onClick: () => {
                setExpanded({})
                setExpandAll((value) => !value)
                setFitted(false)
              },
            },
            expandAll ? '收起长对话' : '展开全部',
          ),
          h('button', { type: 'button', className: 'bm-btn bm-btn-primary', onClick: mode === 'tree' ? treeZoomToFit : zoomToFit }, '适配'),
        ),
        showConclusions && conclusionChips.length > 0
          ? h(
              'div',
              { className: 'bm-conclusions' },
              h('span', { className: 'bm-conclusions-label' }, '关键结论'),
              conclusionChips.slice(0, 4).map((chip) =>
                h(
                  'button',
                  {
                    key: chip.id,
                    type: 'button',
                    className: 'bm-conclusion-chip',
                    title: chip.text,
                    onClick: () => {
                      if (chip.index != null) {
                        if (!walk) {
                          walkInitRef.current = true
                          setWalk(true)
                        }
                        setCursor(chip.index)
                        centeredRef.current = -1; centeredKeyRef.current = ''
                        return
                      }
                      openSession(chip.sessionId)
                    },
                  },
                  `${chip.label}：${chip.text}`,
                ),
              ),
            )
          : null,
        error
          ? h(
              'div',
              { className: 'bm-error', role: 'alert' },
              h('span', null, error),
              h('button', { type: 'button', className: 'bm-btn', onClick: () => setError('') }, '关闭'),
            )
          : null,
        h(
          'div',
          { className: 'bm-body', ref: bodyRef },
          h(
            'div',
            {
              className: `bm-viewport${dragging ? ' bm-dragging' : ''}${walk ? ' bm-walk' : ''}`,
              ref: viewportRef,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
          },
          !graph
            ? h(
                'div',
                { className: 'bm-empty' },
                h('strong', null, error ? '读取分支图失败' : '正在读取分支图…'),
                h('span', null, error ? '检查会话是否仍然存在' : ''),
              )
            : h(
                React.Fragment,
                null,
                h('div', {
                  className: 'bm-grid',
                  style: {
                    backgroundSize: `${26 * view.zoom}px ${26 * view.zoom}px`,
                    backgroundPosition: `${view.x}px ${view.y}px`,
                  },
                }),
                mode === 'chain'
                  ? h('div', { className: 'bm-center-mark', 'aria-hidden': 'true' }, h('span', null, '当前轮'))
                  : null,
                mode === 'tree'
                  ? h(
                      'div',
                      {
                        className: 'bm-tree',
                        style: {
                          width: treeLayout.width,
                          height: treeLayout.height,
                          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                        },
                      },
                      h(
                        'svg',
                        { className: 'bm-tree-edges', width: treeLayout.width, height: treeLayout.height, 'aria-hidden': 'true' },
                        treeEdges.map((edge) =>
                          h('path', {
                            key: `tree:${edge.key}`,
                            d: edge.d,
                            className: `bm-edge${edge.active ? '' : ' bm-tree-edge-dim'}`,
                            stroke: edge.color,
                          }),
                        ),
                      ),
                      treeNodes,
                    )
                  : null,
                mode === 'tree' ? null : h(
                  'div',
                  {
                    className: 'bm-world',
                    style: {
                      width: layout.width,
                      height: layout.height,
                      transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                    },
                  },
                  h(
                    'svg',
                    { className: 'bm-edges', width: layout.width, height: layout.height, 'aria-hidden': 'true' },
                    layout.links.map((link) =>
                      h('path', {
                        key: `link:${link.key}`,
                        d: link.d,
                        className: `bm-link${link.active ? ' bm-link-active' : ''}`,
                        stroke: link.color,
                      }),
                    ),
                    layout.edges.map((edge) =>
                      h(
                        'g',
                        { key: `edge:${edge.id}` },
                        h('path', {
                          d: edge.d,
                          className: `bm-edge${edge.active ? '' : ' bm-edge-dim'}`,
                          stroke: edge.color,
                        }),
                        h('circle', { cx: edge.start.x, cy: edge.start.y, r: 3, fill: edge.color, opacity: 0.9 }),
                        h('circle', { cx: edge.end.x, cy: edge.end.y, r: 3, fill: edge.color, opacity: 0.9 }),
                      ),
                    ),
                  ),
                  laneElements,
                  gapElements,
                  nodeElements,
                ),
              ),
          graph && layout.turnElements.length === 0
            ? h(
                'div',
                { className: 'bm-empty' },
                h('strong', null, '这个会话还没有可显示的轮次'),
                h('span', null, '发送一条消息后，这里会出现第一个节点'),
              )
            : null,
          graph
            ? h(
                'div',
                { className: 'bm-zoom' },
                h('button', { type: 'button', className: 'bm-btn', title: '缩小', onClick: () => setView((v) => ({ ...v, zoom: Math.max(0.25, v.zoom / 1.2) })) }, '−'),
                h('span', { className: 'bm-zoom-pct' }, `${Math.round(view.zoom * 100)}%`),
                h('button', { type: 'button', className: 'bm-btn', title: '放大', onClick: () => setView((v) => ({ ...v, zoom: Math.min(2.2, v.zoom * 1.2) })) }, '+'),
                h('button', { type: 'button', className: 'bm-btn', title: '适配画布', onClick: mode === 'tree' ? treeZoomToFit : zoomToFit }, '适配'),
              )
            : null,
        ),
        walk && graph
          ? h(
              'aside',
              { className: 'bm-side' },
              h(
                'div',
                { className: 'bm-side-head' },
                h('span', { className: 'bm-side-title' }, '逐轮检视'),
                h('span', { className: 'bm-side-count' }, `${cursorRef.current + 1} / ${totalTurns}`),
                current && current.hiddenCount > 0
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'bm-btn',
                        title: '恢复本会话中被隐藏的轮次',
                        onClick: () => restoreHidden(graph.current),
                      },
                      `恢复隐藏 ${current.hiddenCount}`,
                    )
                  : null,
                h('button', { type: 'button', className: 'bm-btn', onClick: toggleWalk }, '收起'),
              ),
              h(
                'div',
                { className: 'bm-side-detailbox' },
                selectedInfo
                  ? h(
                      React.Fragment,
                      null,
                      h(
                        'div',
                        { className: 'bm-side-row-top' },
                        h('span', { className: `bm-kind bm-kind-${selectedInfo.assistant.kind}` }, selectedInfo.assistant.tag),
                        h('span', { className: 'bm-side-idx' }, `#${cursorRef.current + 1}`),
                        selectedTurn && selectedTurn.steps > 0 ? h('span', { className: 'bm-side-steps' }, `${selectedTurn.steps} 步`) : null,
                      ),
                      h('div', { className: 'bm-side-detail' }, selectedInfo.assistant.detail || selectedInfo.assistant.summary),
                      h('div', { className: 'bm-side-detail bm-side-detail-user' }, `${selectedInfo.user.tag}：${selectedInfo.user.detail || selectedInfo.user.summary}`),
                      h(
                        'div',
                        { className: 'bm-side-actions' },
                        h('button', { type: 'button', className: 'bm-btn', disabled: cursorRef.current <= 0, onClick: () => walkStep(-1) }, '上一轮'),
                        h('button', { type: 'button', className: 'bm-btn', disabled: cursorRef.current >= totalTurns - 1, onClick: () => walkStep(1) }, '下一轮'),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn',
                            title: '仅从显示中隐藏这一轮；真实会话与上下文不受影响',
                            onClick: () => {
                              const turn = currentTurns[cursorRef.current]
                              if (turn) hideTurn(graph.current, turn.userSeq)
                            },
                          },
                          '隐藏这一轮',
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn',
                            title: '创建一个只保留到这一轮的新分支；之后的轮次留在原分支，不删除任何会话',
                            onClick: () => {
                              const turn = currentTurns[cursorRef.current]
                              if (!turn) return
                              if (turn.assistantSeq == null && turn.userSeq == null) {
                                setError('这一轮没有可用于回退的事件序号')
                                return
                              }
                              setDialog({
                                kind: 'fork',
                                sessionId: graph.current,
                                sessionTitle: current ? current.title : '',
                                seq: turn.assistantSeq ?? turn.userSeq,
                                label: `回退到第 ${cursorRef.current + 1} 轮`,
                                text: '',
                                rewind: true,
                              })
                            },
                          },
                          '回退到这里',
                        ),
                        props.openView
                          ? h('button', { type: 'button', className: 'bm-btn', onClick: () => props.openView('chat', '') }, '回到聊天继续')
                          : null,
                        mainlineId !== graph.current
                          ? h('button', { type: 'button', className: 'bm-btn', onClick: () => assignMainline(graph.current) }, '设为主线')
                          : null,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn bm-btn-primary',
                            onClick: () =>
                              startFork({
                                sessionId: graph.current,
                                item: { kind: 'turn', index: cursorRef.current, turn: currentTurns[cursorRef.current] },
                              }),
                          },
                          '⑂ 从此开新方向',
                        ),
                      ),
                    )
                  : h('div', { className: 'bm-side-detail' }, '这个会话还没有轮次'),
              ),
              h(
                'div',
                { className: 'bm-side-list', ref: sideListRef },
                currentTurns.map((turn, index) => {
                  const info = summarized(graph.current, index)
                  const selected = index === cursorRef.current
                  return h(
                    'div',
                    {
                      key: `side:${index}`,
                      'data-current': selected ? 'true' : 'false',
                      className: `bm-side-row${selected ? ' bm-side-row-on' : ''}${info.assistant.kind === 'conclusion' ? ' bm-side-row-conclusion' : ''}`,
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `第 ${index + 1} 轮，${info.assistant.tag}`,
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setCursor(index)
                          centeredRef.current = -1
                          centeredKeyRef.current = ''
                        }
                      },
                      onClick: () => {
                        setCursor(index)
                        centeredRef.current = -1
                        centeredKeyRef.current = ''
                      },
                    },
                    h(
                      'div',
                      { className: 'bm-side-row-top' },
                      h('span', { className: 'bm-side-idx' }, `#${index + 1}`),
                      h('span', { className: `bm-kind bm-kind-${info.assistant.kind}` }, info.assistant.tag),
                      turn.steps > 0 ? h('span', { className: 'bm-side-steps' }, `${turn.steps} 步`) : null,
                    ),
                    h('div', { className: 'bm-side-ai' }, info.assistant.summary),
                  )
                }),
              ),
            )
          : null,
        ),
        showContextPreview && graph
          ? h(
              'div',
              { className: 'bm-mask', onPointerDown: (event) => { if (event.target === event.currentTarget) setShowContextPreview(false) } },
              h(
                'div',
                { className: 'bm-dialog bm-context-dialog', role: 'dialog', 'aria-label': '当前路径预览' },
                h('h3', null, `当前显示路径 · ${contextPreview.total} 轮`),
                h('p', null, '显示路径：不包含被隐藏的轮次；真实会话日志与模型上下文都未被修改，因此它不是实际请求内容的精确副本。'),
                h(
                  'div',
                  { className: 'bm-preview-list' },
                  contextPreview.sections.length === 0
                    ? h('div', { className: 'bm-preview-empty' }, '还没有可预览的轮次')
                    : contextPreview.sections.map((section) =>
                        h(
                          'div',
                          { key: `preview:${section.id}`, className: 'bm-preview-section' },
                          h(
                            'div',
                            { className: 'bm-preview-session' },
                            h('span', null, section.title),
                            section.hiddenCount > 0
                              ? h('span', { className: 'bm-preview-hidden' }, `已隐藏 ${section.hiddenCount} 轮`)
                              : null,
                          ),
                          section.turns.length === 0
                            ? h('div', { className: 'bm-preview-empty' }, '（无可见轮次）')
                            : section.turns.map((turn, index) => {
                                const info = summarized(section.id, index)
                                return h(
                                  'div',
                                  { key: `preview:${section.id}:${index}`, className: 'bm-preview-row' },
                                  h('span', { className: `bm-kind bm-kind-${info.assistant.kind}` }, info.assistant.tag),
                                  h('span', { className: 'bm-preview-text' }, `#${index + 1} ${info.assistant.summary}`),
                                )
                              }),
                        ),
                      ),
                ),
                h(
                  'div',
                  { className: 'bm-actions' },
                  current && current.hiddenCount > 0
                    ? hostDerive
                      ? h(
                          'button',
                          { type: 'button', className: 'bm-btn bm-btn-primary', disabled: busy, onClick: openDerivePreview },
                          '派生会话（删隐藏轮）',
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn',
                            disabled: true,
                            title: '需要重启 DSH 让 Host 加载 Phase 5 派生能力',
                          },
                          '派生（需重启）',
                        )
                    : null,
                  h('button', { type: 'button', className: 'bm-btn', onClick: exportContextMarkdown }, '导出 Markdown'),
                  h('button', { type: 'button', className: 'bm-btn', onClick: () => setShowContextPreview(false) }, '关闭'),
                ),
              ),
            )
          : null,
        dialog
          ? h(
              'div',
              { className: 'bm-mask', onPointerDown: (event) => { if (event.target === event.currentTarget) setDialog(null) } },
              dialog.kind === 'derive'
                ? (() => {
                    const preview = dialog.preview || {}
                    const stats = preview.stats || {}
                    const validation = preview.validation || {}
                    const errors = Array.isArray(validation.errors) ? validation.errors : []
                    const warnings = Array.isArray(validation.warnings) ? validation.warnings : []
                    const kept = Array.isArray(stats.keptTurns) ? stats.keptTurns.length : null
                    const dropped = Array.isArray(stats.droppedTurns) ? stats.droppedTurns.length : null
                    return h(
                      'div',
                      { className: 'bm-dialog', role: 'dialog', 'aria-label': '派生会话' },
                      h('h3', null, '删除隐藏轮并生成派生会话'),
                      h(
                        'p',
                        null,
                        `源会话保留约 ${kept ?? '?'} 轮、删除 ${dropped ?? '?'} 轮；seed ${stats.seedEvents ?? '?'} 个事件。不会修改源会话。`,
                      ),
                      errors.length > 0
                        ? h('div', { className: 'bm-dialog-error' }, `校验错误：${errors.slice(0, 4).join('；')}`)
                        : null,
                      warnings.length > 0
                        ? h('div', { className: 'bm-dialog-warn' }, `告警：${warnings.slice(0, 3).join('；')}`)
                        : null,
                      h('p', null, '创建后会新建一个会话并打开；源会话和所有分支都保留，可以随时切回。'),
                      h(
                        'div',
                        { className: 'bm-actions' },
                        h('button', { type: 'button', className: 'bm-btn', onClick: () => setDialog(null) }, '取消'),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn bm-btn-primary',
                            disabled: busy || !preview.creatable,
                            onClick: createDerivedSession,
                          },
                          busy ? '创建中…' : '创建派生会话',
                        ),
                      ),
                    )
                  })()
                : dialog.kind === 'fork'
                ? h(
                    'div',
                    { className: 'bm-dialog', role: 'dialog', 'aria-label': '新建分支' },
                    h('h3', null, dialog.rewind ? '回退到这里' : '从这里开分支'),
                    h(
                      'p',
                      null,
                      dialog.rewind
                        ? `创建一个只保留到「${dialog.sessionTitle}」这一轮的新分支；之后的轮次留在原分支，不删除任何会话。`
                        : `从「${dialog.sessionTitle}」当前这一轮之后分叉，保留该轮及之前的上下文。`,
                    ),
                    h('input', {
                      className: 'bm-input',
                      value: dialog.label,
                      placeholder: '分支方向，例如：成本角度',
                      maxLength: 80,
                      autoFocus: true,
                      onChange: (event) => setDialog({ ...dialog, label: event.target.value }),
                    }),
                    h(
                      'div',
                      { className: 'bm-actions' },
                      h('button', { type: 'button', className: 'bm-btn', onClick: () => setDialog(null) }, '取消'),
                      h(
                        'button',
                        { type: 'button', className: 'bm-btn bm-btn-primary', disabled: busy, onClick: submitFork },
                        busy ? '创建中…' : '创建分支',
                      ),
                    ),
                  )
                : dialog.kind === 'merge'
                  ? h(
                      'div',
                      { className: 'bm-dialog', role: 'dialog', 'aria-label': '汇总分支结论' },
                      h('h3', null, '汇总分支结论'),
                      h('p', null, '把各分支保存的结论汇总成一条消息；确认后填入当前会话输入框，由你发送。'),
                      h('textarea', {
                        className: 'bm-textarea',
                        value: dialog.text,
                        onChange: (event) => setDialog({ ...dialog, text: event.target.value }),
                      }),
                      dialog.filled
                        ? h('p', null, '已填入当前会话输入框；请检查是否覆盖了未发送的草稿，再关闭本弹窗。')
                        : null,
                      h(
                        'div',
                        { className: 'bm-actions' },
                        h('button', { type: 'button', className: 'bm-btn', onClick: () => setDialog(null) }, '取消'),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn',
                            onClick: () => {
                              try {
                                navigator.clipboard?.writeText?.(dialog.text)
                              } catch {
                                // 复制失败不影响填入
                              }
                            },
                          },
                          '复制',
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'bm-btn bm-btn-primary',
                            onClick: () => {
                              const filled = fillDraft(dialog.text)
                              if (filled) {
                                setDialog({ ...dialog, filled: true })
                              } else {
                                setError('填入输入框失败：已改为复制，请手动粘贴')
                                try {
                                  navigator.clipboard?.writeText?.(dialog.text)
                                } catch {
                                  // 复制失败时保留弹窗
                                }
                              }
                            },
                          },
                          dialog.filled ? '重新填入' : '填入输入框',
                        ),
                      ),
                    )
                  : h(
                    'div',
                    { className: 'bm-dialog', role: 'dialog', 'aria-label': '分支结论' },
                    h('h3', null, '分支结论'),
                    h('p', null, `分支「${dialog.label || dialog.sessionTitle}」。保存后可以带结论回到父会话。`),
                    h('textarea', {
                      className: 'bm-textarea',
                      value: dialog.text,
                      placeholder: '写清楚这条分支确认了什么、结论是什么',
                      onChange: (event) => setDialog({ ...dialog, text: event.target.value }),
                    }),
                    h(
                      'div',
                      { className: 'bm-actions' },
                      h('button', { type: 'button', className: 'bm-btn', onClick: () => setDialog(null) }, '取消'),
                      h(
                        'button',
                        { type: 'button', className: 'bm-btn', disabled: busy, onClick: () => submitConclusion(false) },
                        busy ? '保存中…' : '仅保存',
                      ),
                      dialog.parentId
                        ? h(
                            'button',
                            { type: 'button', className: 'bm-btn bm-btn-primary', disabled: busy, onClick: () => submitConclusion(true) },
                            busy ? '处理中…' : '保存并回填父会话',
                          )
                        : null,
                    ),
                  ),
            )
          : null,
      )
    }

    const plugin = {
      inject: ['slots', 'sessions', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => {
          // 热重载会重新执行 apply；先清掉旧实例的样式，避免两份规则叠在一起。
          for (const stale of document.querySelectorAll('style[data-plugin="dsh-branch-map"]')) stale.remove()
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-branch-map'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        })

        const View = (props) => h(BranchMapView, { ...props, pluginCtx: ctx })
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            {
              name: 'conversation.view',
              id: 'branch-map',
              order: 15,
              label: () => '分支图',
            },
            View,
          ),
        )
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'branch-map-return',
              order: 200,
            },
            PendingDraftHelper,
          ),
        )
      },
    }
    return plugin
  },
})
