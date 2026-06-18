/* ===========================================================
   StressTest My Plan — engine + app controller
   Built-in, deterministic generation from data.js. A single generate()
   seam (see ENGINE) is where a real LLM can be swapped in later.
   =========================================================== */
'use strict';
const KB = window.STKB;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const uid = () => 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const RANK = { low: 1, medium: 2, high: 3 };
const trim = (s, n) => { s = (s || '').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
function lowerFirst(s){ return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function nameList(arr){ arr = arr.filter(Boolean); if (!arr.length) return ''; if (arr.length === 1) return arr[0]; if (arr.length === 2) return arr[0] + ' and ' + arr[1]; return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1]; }

/* ===========================================================
   ENGINE  (the generate() seam — replace internals with an LLM later)
   =========================================================== */
const ENGINE = {

  detectSensitive(text) {
    const t = (text || '').toLowerCase();
    const hits = [];
    KB.safety.categories.forEach(cat => {
      if (cat.keywords.some(k => t.includes(k))) hits.push(cat);
    });
    return hits;
  },

  /* Step 1 — discover driving forces from the situation + domain */
  discoverForces(state) {
    const dom = KB.domains[state.domain] || KB.domains.custom;
    const text = [state.fields.planningFor, state.fields.worry, state.fields.hope, state.fields.tried, state.fields.avoiding].join(' ').toLowerCase();
    const scored = {};
    // domain-relevant forces get a base score
    dom.forces.forEach((id, i) => { if (KB.forces[id]) scored[id] = (scored[id] || 0) + (dom.forces.length - i) * 0.5 + 2; });
    // keyword matches across the whole library raise the score (surfaces non-obvious ones)
    Object.keys(KB.forces).forEach(id => {
      const f = KB.forces[id];
      const matches = (f.keywords || []).filter(k => text.includes(k)).length;
      if (matches) scored[id] = (scored[id] || 0) + matches * 1.5 + 1;
    });
    const ids = Object.keys(scored).sort((a, b) => scored[b] - scored[a]).slice(0, 12);
    return ids.map(id => this.forceEntry(id));
  },

  /* build an editable force entry from a KB id */
  forceEntry(id) {
    const f = KB.forces[id] || {};
    return {
      id, kbId: id,
      name: f.name || 'New uncertainty',
      category: f.category || 'Custom',
      why: f.why || '',
      trigger: (f.triggers && f.triggers[0]) || '',
      warning: (f.warning && f.warning[0]) || '',
      likelihood: f.likelihood || 'medium',
      severity: f.severity || 'medium',
      control: f.control || 'medium',
      priority: f.severity === 'high' ? 'high' : 'medium',
      included: true,
      sensitive: !!f.sensitive
    };
  },

  blankForce() {
    return { id: uid(), kbId: null, name: '', category: 'Custom', why: '', trigger: '', warning: '', likelihood: 'medium', severity: 'medium', control: 'medium', priority: 'medium', included: true };
  },

  impact(f) { return (RANK[f.severity] || 2) * (RANK[f.likelihood] || 2) + (f.priority === 'high' ? 1.5 : f.priority === 'low' ? -1 : 0); },

  ranked(state) {
    return state.forces.filter(f => f.included && f.name.trim())
      .slice().sort((a, b) => this.impact(b) - this.impact(a));
  },

  kb(f) { return (f.kbId && KB.forces[f.kbId]) || {}; },

  /* Step 2+3 — four scenario bundles from the selected forces */
  buildScenarios(state) {
    const tone = KB.tones[state.tone] || KB.tones.practical;
    const top = this.ranked(state);
    if (!top.length) return [];
    const names = top.map(f => f.name);
    const lows = top.map(f => lowerFirst(f.name));
    const hope = trim(state.fields.hope, 90) || 'the outcome you’re hoping for';
    const worry = trim(state.fields.worry, 110) || 'the thing you’re worried about';
    const f1 = top[0], k1 = this.kb(f1);
    const f2 = top[1], k2 = this.kb(f2);
    const collect = (key, n) => { const out = []; top.forEach(f => { const k = this.kb(f); (k[key] || []).forEach(x => { if (out.length < n && !out.includes(x)) out.push(x); }); }); return out; };
    const opps = []; top.forEach(f => { const o = this.kb(f).opportunity; if (o && !opps.includes(o)) opps.push(o); });

    const green = {
      key: 'green', color: 'green', name: 'Green', heading: 'Friction, but manageable',
      narrative: `${tone.lead} You move forward and ${nameList(lows.slice(0, 3))} show up — but because you keep some margin, watch the early signs, and respond quickly, they stay manageable rather than threatening. ${cap(hope)} stays realistic.`,
      drivers: names.slice(0, 3),
      timeline: 'Weeks to a few months',
      risks: top.slice(0, 3).map(f => `${f.name}: a contained, recoverable version`),
      opportunities: opps.slice(0, 2),
      warnings: collect('warning', 3),
      decisions: ['Confirm you actually have the margin (cash, time, support) to absorb these', 'Decide the thresholds that would tell you it’s no longer “manageable”']
    };
    const yellow = {
      key: 'yellow', color: 'amber', name: 'Yellow', heading: 'Stress and tradeoffs',
      narrative: `Several pressures arrive close together — ${nameList(lows.slice(0, 4))}. None alone is severe, but together they force real tradeoffs of time, money, or scope. You stay in control, but only by prioritizing hard and asking for help sooner than feels comfortable.`,
      drivers: names.slice(0, 4),
      timeline: '1–3 months',
      risks: top.slice(0, 4).map(f => `${f.name}: manageable alone, costly in combination`),
      opportunities: opps.slice(0, 2),
      warnings: collect('warning', 4),
      decisions: ['Decide what you will protect and what you will let slip', 'Decide who to bring in before you’re forced to', 'Pick the one or two things that get your full attention']
    };
    const redChain = k1.chain ? [k1.chain.immediate, k1.chain.second, k1.chain.third].filter(Boolean) : [];
    const red = {
      key: 'red', color: 'red', name: 'Red', heading: 'Cascading failure',
      narrative: `The risk you named — ${worry} — compounds. ${f1.name} leads to ${lowerFirst(k1.chain ? k1.chain.second : 'knock-on strain')}${f2 ? `, which feeds ${lowerFirst(f2.name)}` : ''}. Decisions turn reactive, and second- and third-order effects start to stack. This is the path worth planning for now, so you can interrupt it early.`,
      drivers: names.slice(0, Math.min(5, names.length)),
      timeline: '3–6+ months if left unaddressed',
      risks: (redChain.length ? redChain : top.slice(0, 3).map(f => f.name)).map(x => cap(x)),
      opportunities: ['Even here: the failure mode shows exactly which system to harden first'],
      warnings: collect('warning', 5),
      decisions: ['Decide your circuit-breakers now — the signals that trigger a change of plan', 'Decide the one dependency to de-risk first', 'Decide who you’d call on day one of this scenario']
    };
    const blueOpp = k1.opportunity || (opps[0] || 'a chance to build a more resilient version of the plan');
    const blue = {
      key: 'blue', color: 'blue', name: 'Blue', heading: 'Disruption with opportunity',
      narrative: `The same difficulty that makes ${lowerFirst(f1.name)} stressful also exposes an opening: ${lowerFirst(blueOpp)} Handled deliberately, the disruption becomes a reason to build something stronger than the original plan.`,
      drivers: [f1.name].concat(names.slice(1, 3)),
      timeline: 'Opens during the stress; pays off over 3–12 months',
      risks: ['The opening closes if all attention goes to defense', 'Moving too early, before the core is stable'],
      opportunities: opps.length ? opps.slice(0, 3) : [blueOpp],
      warnings: ['You keep saying “not yet” to the same opening', 'A competitor or peer moves on it first'],
      decisions: ['Decide whether to invest in the opening now or stage it', 'Decide what to stop doing to free capacity for it']
    };
    return [green, yellow, red, blue];
  },

  /* Step 4 — consequence map rows */
  buildConsequenceMap(state) {
    return this.ranked(state).slice(0, 7).map(f => {
      const k = this.kb(f);
      const chain = k.chain || {};
      return {
        force: f.name,
        trigger: f.trigger || (k.triggers && k.triggers[0]) || f.name,
        immediate: chain.immediate || 'Immediate disruption',
        second: chain.second || 'Knock-on strain elsewhere',
        third: chain.third || 'Compounding pressure over time',
        warning: f.warning || (k.warning && k.warning[0]) || 'Early signs appear',
        prevention: (k.prevention && k.prevention[0]) || 'Put an early check in place',
        opportunity: k.opportunity || 'A chance to build a more resilient system'
      };
    });
  },

  /* Action plan */
  buildActionPlan(state) {
    const dom = KB.domains[state.domain] || KB.domains.custom;
    const top = this.ranked(state);
    const dedup = (arr, n) => { const out = []; arr.forEach(x => { x = (x || '').trim(); if (x && !out.some(o => o.toLowerCase() === x.toLowerCase())) out.push(x); }); return out.slice(0, n); };
    const gather = (key) => { const out = []; top.forEach(f => (this.kb(f)[key] || []).forEach(x => out.push(x))); return out; };

    const doNow = dedup(top.map(f => (this.kb(f).prevention || [])[0]).filter(Boolean), 6);
    const watch = dedup(top.map(f => f.warning || (this.kb(f).warning || [])[0]).filter(Boolean), 7);
    const prepare = dedup(gather('mitigation').concat(top.map(f => (this.kb(f).prevention || [])[1]).filter(Boolean)), 6);

    const AVOID = {
      revenue_delay: 'Covering a structural shortfall with high-interest debt instead of fixing the cost/revenue gap',
      cost_overrun: 'Locking in fixed costs before demand is proven',
      tech_failure: 'Trusting the booking/EHR/critical system without a daily check',
      reputation: 'Arguing with critics publicly instead of fixing the root cause',
      referral_dependency: 'Leaning harder on your one source instead of diversifying',
      client_concentration: 'Deepening dependence on the single client/payer/platform',
      burnout: 'Pushing through warning signs instead of reducing the load',
      documentation_burden: 'Letting documentation slide to chase short-term volume',
      credentialing_payer: 'Assuming claims are fine without reconciling them',
      no_show: 'Over-booking or discounting to paper over a scheduling problem',
      relationship_conflict: 'Avoiding the hard conversation until it’s forced in a crisis',
      data_privacy: 'Putting off basic security “until later”'
    };
    const avoid = dedup(top.map(f => AVOID[f.kbId]).filter(Boolean).concat([
      'Reacting to a single event instead of the underlying pattern',
      'Expanding or adding commitments before operations are stable',
      'Making an irreversible decision while under acute stress'
    ]), 6);

    const opportunity = dedup(top.map(f => this.kb(f).opportunity).filter(Boolean), 5);

    const openQuestions = [
      'What single action would reduce several of these risks at once?',
      'What early sign would tell you this is actually starting?',
      'Which decision becomes much harder if you delay it?',
      'Which decision would make things worse if made too early?',
      'What assumption is doing the most work in your plan?',
      'What is genuinely outside your control here — and worth accepting?'
    ];

    return { doNow, watch, prepare, avoid, askForHelp: dom.help.slice(), opportunity, openQuestions };
  },

  /* recompute all generated outputs from current forces */
  regenerate(state) {
    state.scenarios = this.buildScenarios(state);
    state.consequences = this.buildConsequenceMap(state);
    state.action = this.buildActionPlan(state);
    state.updatedAt = new Date().toISOString();
  }
};

/* ===========================================================
   STATE + PERSISTENCE
   =========================================================== */
const LS_CUR = 'stp_current_v1';
const LS_SAVED = 'stp_saved_v1';
let state = null;

function newState() {
  return {
    id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    title: '', domain: 'business', tone: 'practical',
    fields: { planningFor: '', hope: '', worry: '', affected: '', timeline: '', tried: '', avoiding: '' },
    forces: [], scenarios: [], consequences: [], action: null, sensitive: []
  };
}
function autosave() { try { localStorage.setItem(LS_CUR, JSON.stringify(state)); } catch (e) {} }
function loadCurrent() { try { return JSON.parse(localStorage.getItem(LS_CUR)); } catch (e) { return null; } }
function getSaved() { try { return JSON.parse(localStorage.getItem(LS_SAVED)) || []; } catch (e) { return []; } }
function setSaved(arr) { try { localStorage.setItem(LS_SAVED, JSON.stringify(arr)); } catch (e) {} }

/* ===========================================================
   ROUTER + STEPPER
   =========================================================== */
const STEPS = [
  { id: 'intake',    label: 'Situation' },
  { id: 'forces',    label: 'Driving forces' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'map',       label: 'Consequences' },
  { id: 'plan',      label: 'Action plan' },
  { id: 'export',    label: 'Save & export' }
];
let current = 'landing';

function go(screen) {
  current = screen;
  // regenerate downstream outputs when entering a results screen
  if (screen === 'scenarios' || screen === 'map' || screen === 'plan' || screen === 'export') ENGINE.regenerate(state);
  render();
  autosave();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function stepIndex(id) { return STEPS.findIndex(s => s.id === id); }

/* ===========================================================
   RENDER
   =========================================================== */
const app = () => $('#app');

function render() {
  if (current === 'landing') return renderLanding();
  const idx = stepIndex(current);
  app().innerHTML = `
    ${topbar()}
    ${stepper(idx)}
    ${safetyBanner()}
    <main class="screen-wrap">${screenBody()}</main>
    ${footerBar(idx)}
    ${disclaimerStrip()}
  `;
  wireScreen();
}

function topbar() {
  return `<header class="topbar">
    <button class="brandbtn" data-act="home" aria-label="Home">
      <span class="logo-mark">◷</span><span class="logo-text">StressTest<span class="logo-dim"> My Plan</span></span>
    </button>
    <button class="ghost-btn" data-act="restart">Start over</button>
  </header>`;
}

function stepper(idx) {
  return `<nav class="stepper" aria-label="Progress">
    ${STEPS.map((s, i) => `
      <button class="step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}" data-step="${s.id}" ${i > idx ? 'disabled' : ''}>
        <span class="step-num">${i < idx ? '✓' : i + 1}</span><span class="step-label">${s.label}</span>
      </button>`).join('<span class="step-sep"></span>')}
  </nav>`;
}

function safetyBanner() {
  if (!state.sensitive || !state.sensitive.length) return '';
  return state.sensitive.map(c => `
    <div class="safety-banner" role="alert">
      <div class="safety-head">🛟 ${esc(c.label)}</div>
      <p>${esc(c.message)}</p>
      <ul>${c.resources.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>`).join('');
}

function disclaimerStrip() {
  return `<p class="disclaimer-strip">This tool is for planning and education only — not legal, medical, financial, or psychological advice, and not a crisis service. For high-stakes decisions, consult a qualified professional. In an emergency, contact local emergency services. It helps organize thinking; it does not predict the future.</p>`;
}

function footerBar(idx) {
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const nextLabels = { intake: 'Find driving forces →', forces: 'Build scenarios →', scenarios: 'Map consequences →', map: 'Build action plan →', plan: 'Save & export →' };
  return `<div class="footerbar">
    ${prev ? `<button class="btn btn-ghost" data-step="${prev.id}">← ${prev.label}</button>` : '<span></span>'}
    ${next ? `<button class="btn btn-primary" data-act="next">${nextLabels[current] || ('Next: ' + next.label + ' →')}</button>` : '<span></span>'}
  </div>`;
}

function screenBody() {
  switch (current) {
    case 'intake': return renderIntake();
    case 'forces': return renderForces();
    case 'scenarios': return renderScenarios();
    case 'map': return renderMap();
    case 'plan': return renderPlan();
    case 'export': return renderExport();
    default: return '';
  }
}

/* ---------------- LANDING ---------------- */
function renderLanding() {
  const saved = getSaved();
  app().innerHTML = `
  <div class="landing">
    <header class="topbar landing-top">
      <button class="brandbtn" data-act="home"><span class="logo-mark">◷</span><span class="logo-text">StressTest<span class="logo-dim"> My Plan</span></span></button>
      <button class="ghost-btn" data-act="see-example">See example</button>
    </header>

    <section class="hero">
      <p class="eyebrow">Scenario planning, before it’s a crisis</p>
      <h1>Stress-test your plan<br>before reality does.</h1>
      <p class="hero-sub">A guided tool for founders, clinicians, and professionals who want to see uncertainty earlier, prepare smarter, and turn risk into options. The worst time to build a plan is after the scenario has already arrived.</p>
      <div class="hero-cta">
        <button class="btn btn-primary btn-lg" data-act="start">Run a scenario</button>
        <button class="btn btn-outline btn-lg" data-act="see-example">See an example</button>
      </div>
      ${saved.length ? `<button class="link-btn" data-act="open-saved">Open a saved plan (${saved.length})</button>` : ''}
      <p class="hero-note">The purpose isn’t to create fear. It’s to create options.</p>
    </section>

    <section class="band">
      <h2 class="band-title">How it works — four steps</h2>
      <div class="how-grid">
        ${[
          ['1', 'Name it', 'Describe the decision or worry. The app surfaces the uncertainties and hidden dependencies you may be missing.'],
          ['2', 'Explore it', 'See how each issue could play out — best case, expected, slow-burn, sudden shock, worst case, and hidden opportunity.'],
          ['3', 'Combine it', 'Real life delivers interacting problems. Get four plausible scenario bundles, from manageable friction to cascading failure.'],
          ['4', 'Map it', 'Trace second- and third-order consequences, then leave with a practical action plan — not a pile of worries.']
        ].map(([n, t, d]) => `<div class="how-card"><span class="how-num">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
      </div>
    </section>

    <section class="band alt">
      <div class="who">
        <div>
          <h2 class="band-title left">Who it’s for</h2>
          <ul class="who-list">
            <li>A clinician starting or running a private practice</li>
            <li>A founder launching a product or service</li>
            <li>A business leaning on one client, payer, platform, or person</li>
            <li>A professional navigating career or operational uncertainty</li>
            <li>A team preparing for staffing, regulatory, or reputational risk</li>
          </ul>
        </div>
        <div class="example-peek">
          <div class="peek-tag">Example output</div>
          <div class="peek-scn green">Green — Friction, but manageable</div>
          <div class="peek-scn amber">Yellow — Stress and tradeoffs</div>
          <div class="peek-scn red">Red — Cascading failure</div>
          <div class="peek-scn blue">Blue — Disruption with opportunity</div>
          <button class="link-btn" data-act="see-example">See the full example →</button>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="boundaries">
        <h2 class="band-title">What this is — and isn’t</h2>
        <p>This is a structured thinking and planning tool. It is <strong>not</strong> therapy, legal advice, financial advice, medical advice, or crisis counseling. It won’t diagnose, predict specific outcomes, or replace professional judgment. For high-stakes decisions, bring in a qualified professional. If you’re in immediate danger or crisis, contact emergency services or a crisis line.</p>
      </div>
    </section>

    <footer class="landing-foot">
      <button class="btn btn-primary btn-lg" data-act="start">Run a scenario</button>
      <p>Name it. Explore it. Combine it. Map it. Act on it. Revisit it.</p>
    </footer>
  </div>`;
  wireLanding();
}

/* ---------------- INTAKE ---------------- */
function renderIntake() {
  const f = state.fields;
  const domOpts = Object.keys(KB.domains).map(k => `<option value="${k}" ${state.domain === k ? 'selected' : ''}>${esc(KB.domains[k].label)}</option>`).join('');
  const field = (name, label, ph, big) => big
    ? `<label class="field"><span>${label}</span><textarea name="${name}" rows="2" placeholder="${esc(ph)}">${esc(f[name])}</textarea></label>`
    : `<label class="field"><span>${label}</span><input name="${name}" value="${esc(f[name])}" placeholder="${esc(ph)}" /></label>`;
  return `
  <div class="card intro-card">
    <h1 class="screen-title">What are you trying to think through?</h1>
    <p class="screen-sub">Describe it the way it actually is — messy is fine. The more honest the inputs, the more useful the map. Only “what are you planning for?” is required.</p>
  </div>
  <form id="intake-form" class="card">
    <label class="field"><span>What are you planning for? <em>(required)</em></span>
      <textarea name="planningFor" rows="3" placeholder="e.g. Launching a small private practice; deciding whether to take on a big client; a decision, risk, or uncertainty on your mind…">${esc(f.planningFor)}</textarea></label>
    <label class="field"><span>What domain does this involve?</span>
      <select name="domain">${domOpts}</select></label>
    <div class="field-grid">
      ${field('hope', 'What outcome are you hoping for?', 'The good version')}
      ${field('worry', 'What outcome are you worried about?', 'The version that keeps you up')}
      ${field('affected', 'Who would be affected?', 'You, family, clients, staff…')}
      ${field('timeline', 'What’s the timeline?', 'e.g. next 6 months')}
    </div>
    ${field('tried', 'What have you already tried or set up?', 'Anything in motion already', true)}
    ${field('avoiding', 'What decision are you avoiding or delaying?', 'The one you keep putting off', true)}
    <p class="field-hint">Nothing here leaves your device — inputs are stored locally in your browser.</p>
  </form>`;
}

/* ---------------- FORCES ---------------- */
function renderForces() {
  const opts = (sel, vals) => vals.map(v => `<option value="${v}" ${sel === v ? 'selected' : ''}>${cap(v)}</option>`).join('');
  const cards = state.forces.map(fc => {
    const k = ENGINE.kb(fc);
    return `<div class="force-card ${fc.included ? '' : 'excluded'} ${fc.sensitive ? 'sensitive' : ''}" data-id="${fc.id}">
      <div class="force-top">
        <input class="force-name" data-field="name" data-id="${fc.id}" value="${esc(fc.name)}" placeholder="Name this uncertainty" />
        <label class="incl"><input type="checkbox" data-act="incl" data-id="${fc.id}" ${fc.included ? 'checked' : ''}><span>Include</span></label>
      </div>
      <div class="force-cat">${esc(fc.category)}</div>
      <textarea class="force-why" data-field="why" data-id="${fc.id}" rows="3" placeholder="Why does it matter?">${esc(fc.why)}</textarea>
      <div class="force-mini">
        <label><span>Possible trigger</span><input data-field="trigger" data-id="${fc.id}" value="${esc(fc.trigger)}" placeholder="What could set it off"></label>
        <label><span>Early warning sign</span><input data-field="warning" data-id="${fc.id}" value="${esc(fc.warning)}" placeholder="The first thing you'd notice"></label>
      </div>
      <div class="force-selects">
        <label><span>Likelihood</span><select data-field="likelihood" data-id="${fc.id}">${opts(fc.likelihood, ['low','medium','high'])}</select></label>
        <label><span>Severity</span><select data-field="severity" data-id="${fc.id}">${opts(fc.severity, ['low','medium','high'])}</select></label>
        <label><span>Your control</span><select data-field="control" data-id="${fc.id}">${opts(fc.control, ['low','medium','high'])}</select></label>
        <label><span>Priority</span><select data-field="priority" data-id="${fc.id}">${opts(fc.priority, ['low','medium','high'])}</select></label>
        <button class="icon-x" data-act="remove" data-id="${fc.id}" title="Remove" aria-label="Remove">✕</button>
      </div>
    </div>`;
  }).join('');
  const included = state.forces.filter(f => f.included && f.name.trim()).length;
  return `
  <div class="card intro-card">
    <h1 class="screen-title">Step 1 · Driving forces & uncertainties</h1>
    <p class="screen-sub">Here’s what could put pressure on your plan, based on what you described. Keep the ones that fit, edit freely, drop the rest, and add your own. Aim for 5–15. <strong>${included} included.</strong></p>
  </div>
  <div class="forces-grid">${cards || '<p class="empty">No forces yet — add one below.</p>'}</div>
  <button class="btn btn-outline btn-add" data-act="add-force">＋ Add your own uncertainty</button>`;
}

/* ---------------- SCENARIOS ---------------- */
function renderScenarios() {
  const toneOpts = Object.keys(KB.tones).map(k => `<option value="${k}" ${state.tone === k ? 'selected' : ''}>${esc(KB.tones[k].label)}</option>`).join('');
  const cards = (state.scenarios || []).map(s => `
    <article class="scn-card ${s.color}">
      <header class="scn-head">
        <span class="scn-dot"></span>
        <div><div class="scn-name">${s.name} scenario</div><h3>${esc(s.heading)}</h3></div>
      </header>
      <p class="scn-narr">${esc(s.narrative)}</p>
      <div class="scn-meta"><span class="scn-chip">⏱ ${esc(s.timeline)}</span>${s.drivers.map(d => `<span class="scn-chip ghost">${esc(d)}</span>`).join('')}</div>
      <div class="scn-cols">
        ${scnList('Main risks', s.risks)}
        ${scnList('Opportunities', s.opportunities)}
        ${scnList('Early warning signs', s.warnings)}
        ${scnList('Decisions required', s.decisions)}
      </div>
    </article>`).join('');
  return `
  <div class="card intro-card">
    <h1 class="screen-title">Steps 2 & 3 · Scenario bundles</h1>
    <p class="screen-sub">Real situations rarely deliver one clean problem. These four bundles combine your driving forces into plausible futures — so you can plan across the range, not just the outcome you fear or prefer.</p>
    <label class="tone-pick"><span>Tone</span><select id="tone-select">${toneOpts}</select></label>
  </div>
  <div class="scn-grid">${cards || '<p class="empty">Add a few driving forces first.</p>'}</div>`;
}
function scnList(title, arr) {
  if (!arr || !arr.length) return '';
  return `<div class="scn-col"><h4>${title}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

/* ---------------- CONSEQUENCE MAP ---------------- */
function renderMap() {
  const rows = (state.consequences || []).map(r => `
    <tr>
      <td class="cm-trigger"><strong>${esc(r.trigger)}</strong></td>
      <td>${esc(r.immediate)}</td>
      <td>${esc(r.second)}</td>
      <td>${esc(r.third)}</td>
      <td class="cm-warn">${esc(r.warning)}</td>
      <td class="cm-prev">${esc(r.prevention)}</td>
      <td class="cm-opp">${esc(r.opportunity)}</td>
    </tr>`).join('');
  const cards = (state.consequences || []).map(r => `
    <div class="cm-card">
      <div class="cm-card-flow"><strong>${esc(r.trigger)}</strong> → ${esc(r.immediate)} → ${esc(r.second)} → ${esc(r.third)}</div>
      <div class="cm-card-row"><span>⚑ Warning</span>${esc(r.warning)}</div>
      <div class="cm-card-row prev"><span>🛡 Prevention</span>${esc(r.prevention)}</div>
      <div class="cm-card-row opp"><span>✦ Opportunity</span>${esc(r.opportunity)}</div>
    </div>`).join('');
  return `
  <div class="card intro-card">
    <h1 class="screen-title">Step 4 · Consequence map</h1>
    <p class="screen-sub">Trigger → immediate effect → second-order → third-order → warning sign → prevention → opportunity. This is the part that turns a pile of worries into a map you can act on.</p>
  </div>
  <div class="cm-table-wrap card">
    <table class="cm-table">
      <thead><tr><th>Trigger</th><th>Immediate</th><th>Second-order</th><th>Third-order</th><th>Warning sign</th><th>Prevention</th><th>Opportunity</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="empty">Add driving forces to generate the map.</td></tr>'}</tbody>
    </table>
  </div>
  <div class="cm-cards">${cards}</div>`;
}

/* ---------------- ACTION PLAN ---------------- */
function renderPlan() {
  const a = state.action || {};
  const sec = (icon, title, sub, items, cls) => `
    <section class="plan-sec ${cls}">
      <h3><span class="plan-ic">${icon}</span>${title}</h3>
      <p class="plan-sub">${sub}</p>
      <ul>${(items || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul>
    </section>`;
  return `
  <div class="card intro-card">
    <h1 class="screen-title">Your action plan</h1>
    <p class="screen-sub">Move from fear to agency. Reduce what’s avoidable, prepare for what isn’t, and notice the opportunity inside the risk.</p>
  </div>
  <div class="plan-grid">
    ${sec('✅', 'Do now', 'High-leverage moves for the next 7 days.', a.doNow, 'do')}
    ${sec('👁', 'Watch closely', 'Early warning signs to monitor.', a.watch, 'watch')}
    ${sec('🧰', 'Prepare', 'Backups, documents, and conversations to set up.', a.prepare, 'prep')}
    ${sec('⛔', 'Avoid', 'Moves that tend to make things worse.', a.avoid, 'avoid')}
    ${sec('🤝', 'Ask for help', 'People who may need to be involved before it escalates.', a.askForHelp, 'help')}
    ${sec('✦', 'Opportunity', 'Strategic openings inside the risk.', a.opportunity, 'opp')}
  </div>
  ${sec('❓', 'Questions worth sitting with', 'The strategic review — answer these before you commit.', a.openQuestions, 'ask card')}`;
}

/* ---------------- EXPORT / SAVE ---------------- */
function renderExport() {
  const saved = getSaved();
  return `
  <div class="card intro-card">
    <h1 class="screen-title">Save, revisit & export</h1>
    <p class="screen-sub">You should leave with a map, not a pile of worries. Save this so you can stress-test it again with new assumptions in a few days — “incubation” often surfaces what the first pass missed.</p>
  </div>
  <div class="card">
    <label class="field"><span>Name this plan</span><input id="save-title" value="${esc(state.title || state.fields.planningFor.slice(0, 60))}" placeholder="e.g. Practice launch — Q3"></label>
    <div class="export-actions">
      <button class="btn btn-primary" data-act="save">💾 Save plan</button>
      <button class="btn btn-outline" data-act="print">🖨 Export / Print to PDF</button>
      <button class="btn btn-outline" data-act="rerun">↻ Re-run with new assumptions</button>
      <button class="btn btn-ghost" data-act="restart">Start a new plan</button>
    </div>
    <p class="field-hint">“Export / Print to PDF” opens your browser’s print dialog — choose “Save as PDF.” Saved plans live in this browser.</p>
  </div>
  ${saved.length ? `<div class="card">
    <h3 class="block-title">Saved plans</h3>
    <ul class="saved-list">
      ${saved.map(s => `<li><div><strong>${esc(s.title || 'Untitled plan')}</strong><span class="saved-meta">${esc(KB.domains[s.domain] ? KB.domains[s.domain].label : s.domain)} · ${new Date(s.updatedAt).toLocaleDateString()}</span></div>
        <div class="saved-btns"><button class="link-btn" data-act="load" data-id="${s.id}">Open</button><button class="link-btn danger" data-act="del" data-id="${s.id}">Delete</button></div></li>`).join('')}
    </ul></div>` : ''}
  ${printSummary()}`;
}

/* a print-only one-page brief assembled from the full plan */
function printSummary() {
  const a = state.action || {};
  const block = (t, items) => `<h3>${t}</h3><ul>${(items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<div id="print-summary">
    <h1>StressTest My Plan — Brief</h1>
    <p class="ps-meta">${esc(state.title || state.fields.planningFor)} · ${esc((KB.domains[state.domain] || {}).label || '')} · ${new Date().toLocaleDateString()}</p>
    <h2>Situation</h2>
    <p>${esc(state.fields.planningFor)}</p>
    ${state.fields.worry ? `<p><strong>Worried about:</strong> ${esc(state.fields.worry)}</p>` : ''}
    <h2>Driving forces</h2>
    <ul>${ENGINE.ranked(state).map(f => `<li><strong>${esc(f.name)}</strong> — ${cap(f.likelihood)} likelihood / ${cap(f.severity)} severity</li>`).join('')}</ul>
    <h2>Scenarios</h2>
    ${(state.scenarios || []).map(s => `<p><strong>${s.name} — ${esc(s.heading)}:</strong> ${esc(s.narrative)}</p>`).join('')}
    <h2>Consequence map</h2>
    <table class="ps-table"><thead><tr><th>Trigger</th><th>2nd-order</th><th>3rd-order</th><th>Prevention</th></tr></thead>
    <tbody>${(state.consequences || []).map(r => `<tr><td>${esc(r.trigger)}</td><td>${esc(r.second)}</td><td>${esc(r.third)}</td><td>${esc(r.prevention)}</td></tr>`).join('')}</tbody></table>
    <h2>Action plan</h2>
    ${block('Do now', a.doNow)} ${block('Watch', a.watch)} ${block('Prepare', a.prepare)} ${block('Avoid', a.avoid)} ${block('Ask for help', a.askForHelp)} ${block('Opportunity', a.opportunity)}
    <p class="ps-disc">For planning and education only — not legal, medical, financial, or psychological advice. Consult a qualified professional for high-stakes decisions.</p>
  </div>`;
}

/* ===========================================================
   EVENT WIRING
   =========================================================== */
function wireLanding() {
  $$('[data-act]').forEach(el => el.onclick = () => {
    const a = el.dataset.act;
    if (a === 'start') startNew();
    else if (a === 'see-example') loadExample();
    else if (a === 'open-saved') go('export');
    else if (a === 'home') renderLanding();
  });
}

function wireScreen() {
  // top + footer + stepper
  $$('[data-act]').forEach(el => el.onclick = () => handleAct(el.dataset.act, el));
  $$('[data-step]').forEach(el => el.onclick = () => { if (!el.disabled) go(el.dataset.step); });

  if (current === 'intake') {
    const form = $('#intake-form');
    form.addEventListener('input', e => {
      const n = e.target.name; if (!n) return;
      if (n === 'domain') state.domain = e.target.value; else state.fields[n] = e.target.value;
      autosave();
    });
  }
  if (current === 'forces') {
    $$('[data-field]').forEach(el => el.addEventListener('input', () => {
      const fc = state.forces.find(f => f.id === el.dataset.id); if (!fc) return;
      fc[el.dataset.field] = el.value; autosave();
    }));
    $$('[data-act="incl"]').forEach(el => el.onchange = () => {
      const fc = state.forces.find(f => f.id === el.dataset.id); if (fc) { fc.included = el.checked; autosave(); render(); }
    });
  }
  if (current === 'scenarios') {
    const t = $('#tone-select');
    if (t) t.onchange = () => { state.tone = t.value; ENGINE.regenerate(state); autosave(); render(); };
  }
}

function handleAct(a, el) {
  switch (a) {
    case 'home': if (confirmLeave()) renderLanding(); break;
    case 'restart': if (confirm('Start a new plan? Your current inputs will be cleared (saved plans are kept).')) startNew(); break;
    case 'next': nextStep(); break;
    case 'add-force': state.forces.push(ENGINE.blankForce()); autosave(); render(); break;
    case 'remove': state.forces = state.forces.filter(f => f.id !== el.dataset.id); autosave(); render(); break;
    case 'save': savePlan(); break;
    case 'print': window.print(); break;
    case 'rerun': go('intake'); toast('Adjust any inputs, then step forward to re-generate.'); break;
    case 'load': loadSaved(el.dataset.id); break;
    case 'del': delSaved(el.dataset.id); break;
  }
}

function nextStep() {
  if (current === 'intake') {
    if (!state.fields.planningFor.trim()) { toast('Add what you’re planning for to continue.'); return; }
    state.sensitive = ENGINE.detectSensitive([state.fields.planningFor, state.fields.worry, state.fields.affected].join(' '));
    if (!state.forces.length) state.forces = ENGINE.discoverForces(state);
    go('forces'); return;
  }
  const idx = stepIndex(current);
  if (current === 'forces' && !state.forces.some(f => f.included && f.name.trim())) { toast('Include at least one driving force.'); return; }
  go(STEPS[Math.min(idx + 1, STEPS.length - 1)].id);
}

/* ===========================================================
   ACTIONS
   =========================================================== */
function startNew() { state = newState(); autosave(); go('intake'); }
function startNewKeepSaved() { state = newState(); autosave(); go('intake'); }

function loadExample() {
  const ex = KB.example;
  state = newState();
  state.title = ex.title; state.domain = ex.domain; state.tone = ex.tone;
  Object.assign(state.fields, ex.fields);
  state.forces = ex.forces.map(id => ENGINE.forceEntry(id));
  state.sensitive = [];
  ENGINE.regenerate(state); autosave();
  go('scenarios');
}

function savePlan() {
  const titleEl = $('#save-title');
  state.title = (titleEl && titleEl.value.trim()) || state.fields.planningFor.slice(0, 60) || 'Untitled plan';
  state.updatedAt = new Date().toISOString();
  const saved = getSaved();
  const i = saved.findIndex(s => s.id === state.id);
  const snap = JSON.parse(JSON.stringify(state));
  if (i >= 0) saved[i] = snap; else saved.unshift(snap);
  setSaved(saved); render(); toast('Saved.');
}
function loadSaved(id) {
  const s = getSaved().find(x => x.id === id); if (!s) return;
  state = JSON.parse(JSON.stringify(s)); ENGINE.regenerate(state); autosave(); go('scenarios');
}
function delSaved(id) {
  if (!confirm('Delete this saved plan?')) return;
  setSaved(getSaved().filter(x => x.id !== id)); render();
}

function confirmLeave() { return confirm('Go back to the start page? Your current plan is auto-saved and you can resume it.'); }

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ===========================================================
   BOOT
   =========================================================== */
function boot() {
  const saved = loadCurrent();
  state = (saved && saved.fields) ? saved : newState();
  renderLanding();
}
boot();
