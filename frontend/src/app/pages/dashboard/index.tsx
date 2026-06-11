import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================
// TYPES
// ============================================
interface Agent {
  name: string;
  score: number;
  delta: string;
  calls: number;
  enrolls: number;
  dept: string;
}

interface Call {
  id: number;
  agentIdx: number;
  agentName: string;
  agentDept: string;
  score: number;
  outcome: string;
  flags: string[];
  date: Date;
  duration: string;
  campaign: string;
  client: string;
  leadSource: string;
  subId: string;
  expanded: boolean;
}

interface LeadSource {
  source: string;
  subId: string;
  campaign: string;
  adSet: string;
  leads: number;
  contacts: number;
  billable: number;
  enrolls: number;
  avgDeal: number;
  qaAvg: number;
  score: number;
  flag: string;
}

interface CheckpointItem {
  id: string;
  text: string;
  pts: number;
  autoFail?: boolean;
}

interface CheckpointCategory {
  cat: string;
  items: CheckpointItem[];
}

interface AcademyCall extends Call {
  academyTag: 'exemplar' | 'featured' | 'warning';
  markers: Array<{ id: string; label: string; color: string; time: string }>;
  collection: string;
}

interface Report {
  type: 'friday_executive' | 'nightly';
  date: string;
  title: string;
  calls: number;
  qa: number;
  enrolls: number;
  pips: number;
}

interface SdrAgent extends Agent {
  agentColor: string;
  day: number;
  qa: number;
  discAdh: number;
  talkRatio: number;
  objRate: number;
  badTrack: number;
  readiness: number;
  status: 'READY' | 'WATCH' | 'NOT_YET' | 'PROMOTED';
  promoted: boolean;
  dims: {
    qaDim: number;
    discDim: number;
    talkDim: number;
    badDim: number;
    objDim: number;
    callsDim: number;
  };
  trend: 'up' | 'flat';
  lastScore: number;
  promotedDate: string | null;
}

// ============================================
// CONSTANTS
// ============================================
const AGENT_COLORS = ['#e8a020', '#2ecc8e', '#4d8ef0', '#9b6cf0', '#f07020', '#ec4899', '#14b8a6', '#f87171', '#6366f1', '#34d399', '#fbbf24', '#60a5fa', '#c084fc', '#fb923c', '#22d3ee', '#f43f5e', '#84cc16', '#e879f9', '#2dd4bf', '#fb7185', '#a3e635', '#38bdf8', '#818cf8', '#f472b6'];

const AGENTS: Agent[] = [
  { name: 'Jamison Bray', score: 82, delta: '+1.2', calls: 1, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Kaila Minarcin', score: 68.8, delta: '+63', calls: 31, enrolls: 0, dept: 'Debt Sales' },
  { name: '411', score: 68, delta: '—', calls: 9, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Bayleigh Tinajero', score: 67.2, delta: '+0.3', calls: 13, enrolls: 0, dept: 'Debt Sales' },
  { name: '302', score: 64.4, delta: '—', calls: 15, enrolls: 1, dept: 'Debt Sales' },
  { name: 'Ryan Choi', score: 63.4, delta: '+3.3', calls: 27, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Terrence Quiroz', score: 62.5, delta: '+4.03', calls: 3, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Mossa Khan', score: 62, delta: '—', calls: 1, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Summer Spence', score: 61, delta: '+4.6', calls: 19, enrolls: 2, dept: 'Debt Sales' },
  { name: '412', score: 59.6, delta: '+46.0', calls: 17, enrolls: 1, dept: 'Debt Sales' },
  { name: 'Fernanda Garcia', score: 59.6, delta: '+3.88', calls: 12, enrolls: 1, dept: 'Debt Sales' },
  { name: 'Alexa Kitchen', score: 57.9, delta: '+4.23', calls: 11, enrolls: 1, dept: 'Debt Sales' },
  { name: 'Brian Martinez', score: 57.1, delta: '—', calls: 33, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Laura Renteria', score: 57.1, delta: '—', calls: 29, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Rain Spence', score: 56.7, delta: '—', calls: 30, enrolls: 0, dept: 'Debt Sales' },
  { name: 'Daniel Lozano', score: 56.3, delta: '—', calls: 21, enrolls: 1, dept: 'Debt Sales' },
  { name: 'Deanna Garcia', score: 72, delta: '+2.1', calls: 18, enrolls: 0, dept: 'Verification' },
  { name: 'Yezenia Gonzalez', score: 68, delta: '+1.5', calls: 22, enrolls: 0, dept: 'Verification' },
  { name: 'Jose Saldana', score: 41.1, delta: '—', calls: 20, enrolls: 0, dept: 'SDR' },
  { name: 'Dolores Vartel', score: 49.3, delta: '—', calls: 18, enrolls: 0, dept: 'SDR' },
  { name: 'Amber Thurmond', score: 44.6, delta: '—', calls: 22, enrolls: 0, dept: 'Jr Closer' },
  { name: 'Cory Sowders', score: 50.8, delta: '—', calls: 16, enrolls: 0, dept: 'Sr Closer' },
  { name: 'Dorian Jenkins', score: 51.7, delta: '—', calls: 25, enrolls: 0, dept: 'Sr Closer' },
  { name: 'Veronica Maldonado', score: 61.8, delta: '—', calls: 12, enrolls: 0, dept: 'Customer Service' },
];

const OUTCOMES = ['Enrolled', 'Callback', 'Declined', 'Debt Pitch', 'Hotique', 'Loan Transfer', 'Not Qualified'];
const CAMPAIGNS = ['City Lending — Debt Relief', 'City Lending — Accelerated', 'CLG Standard', 'Facebook Leads', 'Inbound Web', 'Google Ads'];
const FLAGS = ['Early Debt Pitch', 'Skipped Qualifying', 'Early Decline', 'Skipped Credit Pull', 'Rushed Call'];
const CLIENTS = ['Cory Sowders', 'Manny Leon', 'Dorian Jenkins', 'James Thompson', 'Maria Rodriguez', 'Linda Chen', 'Robert Williams'];

const LEAD_SOURCES: LeadSource[] = [
  { source: 'Facebook', subId: 'FB_CL_003_CA_25-45', campaign: 'CityLending_Debt_Mar', adSet: '25-45_Homeowner_CA', leads: 842, contacts: 338, billable: 112, enrolls: 18, avgDeal: 3800, qaAvg: 55.2, score: 74, flag: 'SCALE' },
  { source: 'Google', subId: 'GGL_DT_001_NAT', campaign: 'DebtRelief_Search', adSet: 'Broad_National', leads: 621, contacts: 211, billable: 68, enrolls: 12, avgDeal: 4200, qaAvg: 58.1, score: 71, flag: 'SCALE' },
  { source: 'Inbound Web', subId: 'WEB_ORG_001', campaign: 'Organic Traffic', adSet: 'SEO', leads: 289, contacts: 162, billable: 58, enrolls: 8, avgDeal: 3600, qaAvg: 61.0, score: 68, flag: 'SCALE' },
  { source: 'Facebook', subId: 'FB_CL_007_TX_35-55', campaign: 'CityLending_Debt_Mar', adSet: '35-55_TX_Renter', leads: 388, contacts: 108, billable: 31, enrolls: 3, avgDeal: 2900, qaAvg: 52.4, score: 48, flag: 'WATCH' },
  { source: 'Aged Lead', subId: 'AGED_Q4_2025_001', campaign: 'Aged List Q4', adSet: '30-60day aged', leads: 201, contacts: 54, billable: 12, enrolls: 1, avgDeal: 2200, qaAvg: 49.8, score: 32, flag: 'KILL' },
  { source: 'Facebook', subId: 'FB_CL_012_FL_ALL', campaign: 'CityLending_Broad_Mar', adSet: 'All_FL_Ages', leads: 312, contacts: 68, billable: 14, enrolls: 1, avgDeal: 1800, qaAvg: 48.2, score: 28, flag: 'KILL' },
  { source: 'Google', subId: 'GGL_DT_004_LOC', campaign: 'Local_Debt_Search', adSet: 'Local_CA', leads: 192, contacts: 88, billable: 32, enrolls: 6, avgDeal: 4100, qaAvg: 59.3, score: 69, flag: 'SCALE' },
];

const CHECKPOINTS_ALL: CheckpointCategory[] = [
  {
    cat: 'Call Quality & Rapport', items: [
      { id: 'CQ01', text: 'Professional greeting with name and company', pts: 3 },
      { id: 'CQ02', text: 'Obtained permission to record the call', pts: 10, autoFail: true },
      { id: 'CQ03', text: 'Clear purpose of call stated early', pts: 2 },
      { id: 'CQ04', text: 'Acknowledged client by name early', pts: 5 },
      { id: 'CQ05', text: 'Acknowledged financial stress or concern', pts: 5 },
      { id: 'CQ06', text: 'Used empathetic statements', pts: 5 },
      { id: 'CQ07', text: 'Avoided judgmental language', pts: 5 },
      { id: 'CQ08', text: 'Allowed client to fully explain', pts: 3 },
      { id: 'CQ09', text: 'Minimized interruptions', pts: 4 },
      { id: 'CQ10', text: 'Asked relevant follow-up questions', pts: 3 },
      { id: 'CQ11', text: 'Paraphrased client statements', pts: 5 },
      { id: 'CQ12', text: 'Warm empathetic tone throughout', pts: 2 },
    ]
  },
  {
    cat: 'Discovery & Qualification', items: [
      { id: 'DQ01', text: 'Asked about debt type, amount, status', pts: 5 },
      { id: 'DQ02', text: 'Identified client goals', pts: 5 },
      { id: 'DQ03', text: 'Explained options for client situation', pts: 5 },
      { id: 'DQ04', text: 'Explained settlement/litigation process', pts: 3 },
      { id: 'DQ05', text: 'Avoided jargon / explained terms', pts: 4 },
      { id: 'DQ06', text: 'Set realistic expectations', pts: 3 },
      { id: 'DQ07', text: 'Addressed risks and benefits honestly', pts: 4 },
    ]
  },
  {
    cat: 'Compliance & Disclosures', items: [
      { id: 'CD01', text: 'Disclosed program is NOT debt settlement', pts: 10, autoFail: true },
      { id: 'CD02', text: 'Disclosed program is NOT credit repair', pts: 10, autoFail: true },
      { id: 'CD03', text: 'Explained scope of lawsuit representation', pts: 10, autoFail: true },
      { id: 'CD04', text: 'Obtained consent for soft credit pull', pts: 10, autoFail: true },
      { id: 'CD05', text: 'Verified client identity', pts: 10, autoFail: true },
      { id: 'CD06', text: 'Disclosed potential credit impact', pts: 5 },
      { id: 'CD07', text: 'Disclosed risk of asset repossession', pts: 5 },
      { id: 'CD08', text: 'Explained client settlement responsibility', pts: 5 },
      { id: 'CD09', text: 'Clarified payments not to creditors directly', pts: 5 },
      { id: 'CD10', text: 'Explained payments applied to legal fees', pts: 5 },
      { id: 'CD11', text: 'Explained implications of stopping payments', pts: 5 },
      { id: 'CD12', text: 'Provided summons disclosure', pts: 5 },
      { id: 'CD13', text: 'Provided required disclaimers', pts: 4 },
      { id: 'CD14', text: 'No legal/financial guarantees stated', pts: 2 },
      { id: 'CD15', text: 'Avoided prohibited language', pts: 4 },
    ]
  },
  {
    cat: 'Objection Handling & Close', items: [
      { id: 'OH01', text: 'Acknowledged objections calmly', pts: 3 },
      { id: 'OH02', text: 'Provided factual objection responses', pts: 3 },
      { id: 'OH03', text: 'Confidence without undue pressure', pts: 4 },
      { id: 'OH04', text: 'Clearly explained next steps', pts: 3 },
      { id: 'OH05', text: 'Confirmed client understanding', pts: 3 },
      { id: 'OH06', text: 'Ended with reassurance and professionalism', pts: 3 },
    ]
  },
];

const GOOD_TRACKERS = [
  'Asked how much debt do you currently owe', 'Asked about total personal loan debt',
  'Asked about accounts in collections', 'Asked if current on payments or falling behind',
  'Asked if employed or receiving income', 'Asked how much they bring home after taxes',
  'Asked if in active bankruptcy', 'Asked for verbal authorization for soft pull',
  'Mentioned cease and desist letters', 'Mentioned power of attorney',
  'Mentioned all communication directed to legal team',
  'Complete contract walk through', 'Verified all info before sending agreement',
];

const BAD_TRACKERS = [
  'Moved forward after debt stated under $7K', 'Mentioned will wipe out all debt',
  'Mentioned these will be the only fees', 'Mentioned this will not affect their credit',
  'Did not obtain consent before pulling credit',
];

const MARKER_TYPES = [
  { id: 'great-opening', label: 'Great Opening', color: 'green', ts: null },
  { id: 'objection-win', label: 'Objection Handled', color: 'green', ts: null },
  { id: 'disclosure-clean', label: 'Disclosure Delivered', color: 'gold', ts: null },
  { id: 'discovery', label: 'Discovery Sequence', color: 'gold', ts: null },
  { id: 'close-attempt', label: 'Close Attempt', color: 'gold', ts: null },
  { id: 'bad-tracker', label: 'Bad Tracker', color: 'red', ts: null },
  { id: 'rushed', label: 'Rushed / Skipped', color: 'red', ts: null },
  { id: 'wrong-info', label: 'Incorrect Info', color: 'red', ts: null },
];

const PAGE_TITLES: Record<string, [string, string]> = {
  'qa-live': ['QA Live Feed', 'City Financial'],
  'academy': ['CF Academy', 'Call Library & Training Markers · City Financial'],
  'sdr-pipeline': ['SDR → Closer Pipeline', '14-Day Readiness Tracker · City Financial'],
  'leaderboard': ['Leaderboard', 'Agent Rankings'],
  'analytics': ['Analytics', 'QA & Performance'],
  'pips': ['PIPs', 'Performance Improvement Plans'],
  'lead-attribution': ['Lead Attribution', 'Sub ID Tracking'],
  'reports': ['Reports', 'Nightly & Friday Executive'],
  'accounting': ['Accounting', 'KPI Board'],
  'debt-board': ['Debt Board', 'KPI Board'],
  'finance-board': ['Finance Board', 'KPI Board'],
  'bbb': ['BBB Dashboard', 'KPI Board'],
  'marketing': ['Marketing KPIs', 'KPI Board'],
  'tax-debt-backend': ['Tax & Debt Backend', 'KPI Board'],
  'tax-prep': ['Tax Prep Tracking', 'KPI Board'],
  'zendesk': ['Zendesk Tickets', 'KPI Board'],
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const agentColor = (i: number) => AGENT_COLORS[i % AGENT_COLORS.length];
const scoreClass = (s: number) => s >= 80 ? 'great' : s >= 50 ? 'ok' : 'bad';
const scoreColor = (s: number) => s >= 80 ? 'var(--green)' : s >= 50 ? 'var(--gold)' : 'var(--red)';
const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const outcomeClass = (o: string) => {
  const map: Record<string, string> = { 'Enrolled': 'green', 'Callback': 'blue', 'Declined': 'red', 'Debt Pitch': 'gold', 'Hotique': 'orange', 'Loan Transfer': 'purple', 'Not Qualified': 'grey' };
  return map[o] || 'grey';
};

// Generate mock calls
const generateMockCalls = (): Call[] => {
  const calls: Call[] = [];
  for (let i = 0; i < 1173; i++) {
    const agentIdx = Math.floor(Math.random() * AGENTS.length);
    const agent = AGENTS[agentIdx];
    const score = Math.max(0, Math.min(100, Math.round(agent.score + (Math.random() - 0.5) * 22)));
    const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
    const flags: string[] = [];
    if (Math.random() > 0.65) flags.push(FLAGS[Math.floor(Math.random() * FLAGS.length)]);
    if (Math.random() > 0.85) flags.push(FLAGS[Math.floor(Math.random() * FLAGS.length)]);
    const now = new Date('2026-03-29T20:00:00');
    const date = new Date(now.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000);
    const durMin = Math.floor(Math.random() * 14) + 2;
    const durSec = Math.floor(Math.random() * 60);
    const leadIdx = Math.floor(Math.random() * LEAD_SOURCES.length);
    calls.push({
      id: i, agentIdx, agentName: agent.name, agentDept: agent.dept,
      score, outcome, flags, date,
      duration: `${durMin}:${String(durSec).padStart(2, '0')}`,
      campaign: CAMPAIGNS[Math.floor(Math.random() * CAMPAIGNS.length)],
      client: Math.random() > 0.4 ? CLIENTS[Math.floor(Math.random() * CLIENTS.length)] : '',
      leadSource: LEAD_SOURCES[leadIdx].source,
      subId: LEAD_SOURCES[leadIdx].subId,
      expanded: false,
    });
  }
  return calls.sort((a, b) => b.date.getTime() - a.date.getTime());
};

// Build Academy call library
const buildAcademyCalls = (allCalls: Call[]): AcademyCall[] => {
  const sorted = [...allCalls].filter(c => c.score !== undefined);
  const top = sorted.filter(c => c.score >= 82).slice(0, 18);
  const bottom = sorted.filter(c => c.score <= 38).slice(0, 12);
  const mid = sorted.filter(c => c.score >= 60 && c.score < 82).slice(0, 6);

  const mkMarkers = (isTop: boolean) => {
    const types = isTop
      ? ['great-opening', 'objection-win', 'disclosure-clean', 'discovery', 'close-attempt']
      : ['bad-tracker', 'rushed', 'wrong-info', 'disclosure-clean'];
    const picked: string[] = [];
    const used = new Set<string>();
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      let t = types[Math.floor(Math.random() * types.length)];
      if (!used.has(t)) { used.add(t); picked.push(t); }
    }
    return picked.map((id) => {
      const m = { min: Math.floor(Math.random() * 12) + 1, sec: Math.floor(Math.random() * 60) };
      const mt = MARKER_TYPES.find(x => x.id === id);
      return { id, label: mt?.label || id, color: mt?.color || 'gold', time: `${m.min}:${String(m.sec).padStart(2, '0')}` };
    });
  };

  return [
    ...top.map(c => ({ ...c, academyTag: 'exemplar' as const, markers: mkMarkers(true), collection: Math.random() > 0.5 ? 'Discovery Masters' : 'Disclosure Excellence' })),
    ...bottom.map(c => ({ ...c, academyTag: 'warning' as const, markers: mkMarkers(false), collection: 'Common Mistakes' })),
    ...mid.map(c => ({ ...c, academyTag: 'featured' as const, markers: mkMarkers(true), collection: 'Featured Calls' })),
  ];
};

// Build SDR agents
const buildSdrAgents = (): SdrAgent[] => {
  return AGENTS.filter(a => a.dept === 'SDR' || a.dept === 'Jr Closer').map((a, i) => {
    const day = Math.floor(Math.random() * 14) + 1;
    const qa = a.score;
    const discAdh = Math.round(60 + Math.random() * 38);
    const talkRatio = Math.round(48 + Math.random() * 30);
    const objRate = Math.round(Math.random() * 5);
    const badTrack = day > 7 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 5);

    const qaDim = Math.min(100, Math.round((qa / 65) * 100));
    const discDim = discAdh;
    const talkDim = Math.round(Math.max(0, (100 - Math.abs(talkRatio - 52) * 5)));
    const badDim = Math.round(Math.max(0, 100 - badTrack * 33));
    const objDim = Math.min(100, objRate * 20);
    const callsDim = Math.min(100, Math.round((a.calls / 25) * 100));

    const readiness = Math.round(
      qaDim * 0.30 +
      discDim * 0.25 +
      talkDim * 0.15 +
      badDim * 0.15 +
      objDim * 0.10 +
      callsDim * 0.05
    );

    const status = readiness >= 72 && day >= 12 ? 'READY'
      : readiness >= 55 && day >= 7 ? 'WATCH'
        : day >= 14 && readiness < 55 ? 'NOT_YET'
          : 'NOT_YET';

    const promoted = Math.random() > 0.85 && a.dept === 'Jr Closer';

    return {
      ...a,
      agentColor: agentColor(AGENTS.indexOf(a)),
      day, qa, discAdh, talkRatio, objRate, badTrack,
      readiness,
      status: promoted ? 'PROMOTED' : status,
      promoted,
      dims: { qaDim, discDim, talkDim, badDim, objDim, callsDim },
      trend: Math.random() > 0.5 ? 'up' : 'flat',
      lastScore: Math.round(qa + (Math.random() - 0.3) * 10),
      promotedDate: promoted ? 'Mar 15, 2026' : null,
    };
  });
};

// Reports data
const REPORTS: Report[] = [
  { type: 'friday_executive', date: 'Mar 28, 2026', title: 'Friday Executive Report', calls: 1023, qa: 54.1, enrolls: 22, pips: 2 },
  { type: 'nightly', date: 'Mar 28, 2026', title: 'Nightly Operations Report', calls: 312, qa: 53.8, enrolls: 7, pips: 2 },
  { type: 'nightly', date: 'Mar 27, 2026', title: 'Nightly Operations Report', calls: 290, qa: 52.4, enrolls: 5, pips: 2 },
  { type: 'nightly', date: 'Mar 26, 2026', title: 'Nightly Operations Report', calls: 320, qa: 55.1, enrolls: 8, pips: 1 },
  { type: 'friday_executive', date: 'Mar 21, 2026', title: 'Friday Executive Report', calls: 962, qa: 53.0, enrolls: 19, pips: 1 },
  { type: 'nightly', date: 'Mar 21, 2026', title: 'Nightly Operations Report', calls: 280, qa: 51.2, enrolls: 4, pips: 1 },
];

// Toast system
let toastCounter = 0;
const showToast = (type: 'critical' | 'warning' | 'success' | 'info', title: string, msg: string, setToasts: React.Dispatch<React.SetStateAction<Array<{ id: number; type: string; title: string; msg: string }>>>) => {
  const id = toastCounter++;
  setToasts(prev => [...prev, { id, type, title, msg }]);
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, 6000);
};

// ============================================
// MAIN COMPONENT
// ============================================
const Dashboard: React.FC = () => {
  // State
  const [activePage, setActivePage] = useState('qa-live');
  const [allCalls] = useState<Call[]>(generateMockCalls);
  const [academyCalls] = useState<AcademyCall[]>(buildAcademyCalls(allCalls));
  const [sdrAgents] = useState<SdrAgent[]>(buildSdrAgents);
  const [toasts, setToasts] = useState<Array<{ id: number; type: string; title: string; msg: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [modalTab, setModalTab] = useState('overview');
  const [filters, setFilters] = useState({ outcome: '', flag: '', score: '', dept: '' });
  const [callFilterCount, setCallFilterCount] = useState(0);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState<'agent' | 'campaign'>('agent');
  const [leaderboardTime, setLeaderboardTime] = useState<'1d' | '2w' | '1m'>('1d');
  const [leadViewMode, setLeadViewMode] = useState<'source' | 'subid'>('source');
  const [leadFlagFilter, setLeadFlagFilter] = useState('');
  const [academyFilter, setAcademyFilter] = useState<'all' | 'exemplar' | 'featured' | 'warning'>('all');
  const [academyDept, setAcademyDept] = useState('');
  const [academyMarker, setAcademyMarker] = useState('');
  const [sdrFilter, setSdrFilter] = useState<'all' | 'ready' | 'watch' | 'not-yet' | 'promoted'>('all');
  const [sdrView, setSdrView] = useState<'board' | 'table' | 'strategy'>('board');
  const [dateFrom, setDateFrom] = useState('2026-03-25');
  const [dateTo, setDateTo] = useState('2026-03-29');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Effects
  useEffect(() => {
    applyFilters();
  }, [filters, allCalls]);

  // Functions
  const applyFilters = () => {
    console.log(allCalls,'allCallsallCalls');
    const filtered = allCalls.filter(c => {
      if (filters.outcome && c.outcome !== filters.outcome) return false;
      if (filters.flag && !c.flags.includes(filters.flag)) return false;
      if (filters.score === 'red' && c.score >= 50) return false;
      if (filters.score === 'yellow' && (c.score < 50 || c.score >= 80)) return false;
      if (filters.score === 'green' && c.score < 80) return false;
      if (filters.dept && c.agentDept !== filters.dept) return false;
      return true;
    });
    setFilteredCalls(filtered.slice(0, 250));
    setCallFilterCount(filtered.length);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeApply = () => {
    showToast('info', 'Date Range Applied', 'Refreshing data for selected date range...', setToasts);
    applyFilters();
  };

  const openScorecard = (call: Call) => {
    setSelectedCall(call);
    setModalOpen(true);
    setModalTab('overview');
  };

  const closeScorecard = () => {
    setModalOpen(false);
    setSelectedCall(null);
  };

  const changeModalTab = (tab: string) => {
    setModalTab(tab);
  };

  const saveScorecard = () => {
    showToast('success', 'Scorecard Saved', 'QA scorecard has been saved to the agent record.', setToasts);
  };

  const shareScorecard = () => {
    showToast('info', 'Link Copied', 'Scorecard link copied to clipboard.', setToasts);
  };

  const flagCall = () => {
    showToast('warning', 'Call Flagged', 'This call has been flagged for management review.', setToasts);
  };

  const generateReport = (type: string) => {
    showToast('info', type === 'nightly' ? 'Nightly Report' : 'Friday Report', 'Report generation triggered. Will email when complete.', setToasts);
  };

  const previewReport = (report: Report) => {
    setSelectedReport(report);
  };

  const showNewPIPModal = () => {
    showToast('info', 'New PIP', 'PIP creation form — connect to backend to enable.', setToasts);
  };

  const academyFilterChange = (type: 'all' | 'exemplar' | 'featured' | 'warning') => {
    setAcademyFilter(type);
  };

  const sdrStageFilter = (filter: 'all' | 'ready' | 'watch' | 'not-yet' | 'promoted') => {
    setSdrFilter(filter);
  };

  const sdrViewChange = (view: 'board' | 'table' | 'strategy') => {
    setSdrView(view);
  };

  const showPromoteModal = (name?: string) => {
    showToast('success', '🚀 Promotion Initiated', name ? `${name} moved to Closer Track. Ramp protocol starts Monday.` : 'Select an agent marked READY to promote.', setToasts);
  };

  const showAutoTagModal = () => {
    showToast('success', 'Auto-Tag Complete', 'analytiq scanned 1,173 calls. Flagged Exemplar and Warning calls for training review.', setToasts);
  };

  const showStageDetail = (stage: number) => {
    const labels = ['', 'Week 1: Observe', 'Week 2: Qualify', 'Eval Gate', 'Closer Track'];
    showToast('info', `Stage ${stage}: ${labels[stage]}`, `Click Strategy tab for full stage details.`, setToasts);
  };

  const leadView = (mode: 'source' | 'subid') => {
    setLeadViewMode(mode);
  };

  const filterLeads = (flag: string) => {
    setLeadFlagFilter(flag);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================
  const renderTicker = () => {
    return AGENTS.slice(0, 22).map((a, i) => {
      const color = agentColor(i);
      const sc = scoreColor(a.score);
      const dSign = a.delta.startsWith('+') ? 'up' : (a.delta === '-' || a.delta === '—') ? '' : 'dn';
      return (
        <div key={a.name} className="ticker-item">
          <div className="ticker-dot" style={{ background: color }}></div>
          <span className="ticker-name">{a.name}</span>
          <span className="ticker-score" style={{ color: sc }}>{a.score}</span>
          {dSign && <span className="ticker-delta" style={{ color: dSign === 'up' ? 'var(--green)' : 'var(--red)' }}>{a.delta}</span>}
        </div>
      );
    });
  };

  const renderCallRows = () => {
    return filteredCalls.map(c => {
      const color = agentColor(c.agentIdx);
      const init = initials(c.agentName);
      const dateStr = c.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + c.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const flagsHtml = c.flags.map(f => <span key={f} className="badge red" style={{ fontSize: '9px' }}>{f}</span>);
      return (
        <div
          key={c.id}
          style={{ display: 'grid', gridTemplateColumns: '260px 70px 90px 100px 130px 1fr', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
          onClick={() => openScorecard(c)}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
          onMouseOut={e => (e.currentTarget.style.background = '')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{init}</div>
            <div>
              <div className="fs-12 fw-600" style={{ color: 'var(--text)' }}>{c.agentName}</div>
              <div className="fs-10 text-muted">{dateStr}</div>
            </div>
          </div>
          <div className="font-mono fw-700" style={{ fontSize: '18px', textAlign: 'right', color: scoreColor(c.score) }}>{c.score}</div>
          <div className="font-mono fs-11 text-muted">{c.duration}</div>
          <div><span className={`badge ${outcomeClass(c.outcome)}`} style={{ fontSize: '10px' }}>{c.outcome}</span></div>
          <div className="fs-11 text-muted">{c.agentDept}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span className="fs-10 text-muted">{c.campaign.split('—')[0].trim()}</span>
            {flagsHtml}
          </div>
        </div>
      );
    });
  };

  const renderSidebarLB = () => {
    const sorted = [...AGENTS].sort((a, b) => b.score - a.score).slice(0, 12);
    return sorted.map((a, i) => {
      const color = agentColor(AGENTS.indexOf(a));
      const sc = scoreColor(a.score);
      return (
        <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="fs-10 text-muted font-mono" style={{ minWidth: '14px' }}>{i + 1}</span>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials(a.name)}</div>
          <span className="fs-11" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{a.name}</span>
          <span className="font-mono fs-11 fw-600" style={{ color: sc }}>{a.score}</span>
        </div>
      );
    });
  };

  const renderSidebarAlerts = () => {
    const alerts = [
      { type: 'critical', icon: '🚨', msg: 'CD02 Disclosure fail — Amber Thurmond' },
      { type: 'warning', icon: '⚠️', msg: 'Rushed call rate 44% — Jose Saldana' },
      { type: 'critical', icon: '🚨', msg: 'Bad tracker: "no credit impact" — Daniel Lozano' },
    ];
    return alerts.map((a, i) => (
      <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{a.icon}</span>
        <span className="fs-11" style={{ color: a.type === 'critical' ? 'var(--red)' : 'var(--gold)', lineHeight: '1.4' }}>{a.msg}</span>
      </div>
    ));
  };

  const renderLeaderboardRows = () => {
    const sorted = [...AGENTS].sort((a, b) => b.score - a.score);
    return sorted.map((a, i) => {
      const color = agentColor(AGENTS.indexOf(a));
      const sc = scoreClass(a.score);
      const avgLen = `${Math.floor(Math.random() * 10 + 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
      const closeRate = a.enrolls > 0 ? ((a.enrolls / a.calls) * 100).toFixed(1) + '%' : '0.0%';
      const pctCalls = ((a.calls / 1023) * 100).toFixed(1) + '%';
      const eff = (Math.random() * 3 + 1).toFixed(2) + 'x';
      const flagged = Math.floor(Math.random() * 18);
      const flagRate = Math.floor(Math.random() * 40) + '%';
      const decision = a.score >= 70 ? 'ON_TRACK' : a.score >= 55 ? 'WATCH' : a.score >= 45 ? 'REVIEW' : 'SEPARATE';
      const decisionLabels: Record<string, string> = { ON_TRACK: '✅ On Track', WATCH: '⚠️ Watch', REVIEW: '🔴 Review', SEPARATE: '❌ Decision Required' };
      return (
        <tr key={a.name}>
          <td className="mono text-muted">{i + 1}</td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials(a.name)}</div>
              <span className="fw-600">{a.name}</span>
            </div>
          </td>
          <td className="fs-11 text-muted">{a.dept}</td>
          <td className={`mono score-${sc}`} style={{ fontSize: '14px' }}>{a.score}</td>
          <td className="mono">{avgLen}</td>
          <td className="mono">{a.calls}</td>
          <td className={`mono ${a.enrolls > 0 ? 'text-green' : ''}`}>{a.enrolls}</td>
          <td className={`mono ${a.enrolls > 0 ? 'text-green' : ''}`}>{closeRate}</td>
          <td className="mono">{pctCalls}</td>
          <td className="mono" style={{ color: 'var(--blue)' }}>{eff}</td>
          <td className={`mono ${flagged > 8 ? 'text-red' : ''}`}>{flagged}</td>
          <td className={`mono ${parseInt(flagRate) > 25 ? 'text-red' : ''}`}>{flagRate}</td>
          <td><span className={`decision-badge ${decision}`}>{decisionLabels[decision]}</span></td>
        </tr>
      );
    });
  };

  const renderTopConverters = () => {
    const sorted = [...AGENTS].sort((a, b) => b.score - a.score).filter(a => a.enrolls > 0).slice(0, 4);
    return sorted.map(a => {
      const pct = (a.enrolls / a.calls) * 100;
      return (
        <div key={a.name} className="progress-row" style={{ marginBottom: '8px' }}>
          <div className="progress-label">{a.name}</div>
          <div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${Math.min(pct * 5, 100)}%`, background: 'var(--green)' }}></div></div>
          <div className="progress-val text-green">{pct.toFixed(1)}%</div>
        </div>
      );
    });
  };

  const renderBelowExpected = () => {
    const below = [...AGENTS].sort((a, b) => b.score - a.score).filter(a => a.score < 50).slice(0, 4);
    return below.map(a => (
      <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
        <span className="fs-11 text-muted">{a.name}</span>
        <span className="font-mono fs-11 text-red fw-600">{a.score}</span>
      </div>
    ));
  };

  const renderLeadRows = () => {
    const data = leadFlagFilter ? LEAD_SOURCES.filter(l => l.flag === leadFlagFilter) : LEAD_SOURCES;
    return data.map((l, i) => {
      const contactRate = ((l.contacts / l.leads) * 100).toFixed(1);
      const billableRate = ((l.billable / l.leads) * 100).toFixed(1);
      const enrollRate = ((l.enrolls / l.leads) * 100).toFixed(1);
      return (
        <tr key={l.subId}>
          <td className="mono text-muted">{i + 1}</td>
          <td className="fw-600">{l.source}</td>
          <td><div className="fs-11 fw-600">{l.subId}</div><div className="fs-10 text-muted">{l.campaign}</div></td>
          <td className="mono">{l.leads.toLocaleString()}</td>
          <td className="mono">{l.contacts}</td>
          <td className={`mono ${parseFloat(contactRate) > 35 ? 'text-green' : parseFloat(contactRate) > 20 ? 'text-gold' : 'text-red'}`}>{contactRate}%</td>
          <td className={`mono ${parseFloat(billableRate) > 15 ? 'text-green' : parseFloat(billableRate) > 8 ? 'text-gold' : 'text-red'}`}>{billableRate}%</td>
          <td className={`mono ${l.enrolls > 5 ? 'text-green' : l.enrolls > 0 ? 'text-gold' : 'text-red'}`}>{l.enrolls}</td>
          <td className={`mono ${parseFloat(enrollRate) > 2 ? 'text-green' : 'text-muted'}`}>{enrollRate}%</td>
          <td className="mono">${l.avgDeal.toLocaleString()}</td>
          <td className="mono" style={{ color: scoreColor(l.qaAvg) }}>{l.qaAvg}</td>
          <td><div className={`lead-score-badge ${l.flag === 'SCALE' ? 'flag-scale' : l.flag === 'WATCH' ? 'flag-watch' : 'flag-kill'}`}>{l.score}</div></td>
          <td><span className={`scale-kill-badge ${l.flag}`}>{l.flag === 'SCALE' ? '🟢 ' + l.flag : l.flag === 'WATCH' ? '🟡 ' + l.flag : '🔴 ' + l.flag}</span></td>
        </tr>
      );
    });
  };

  const renderReportList = () => {
    return REPORTS.map((r, i) => (
      <div key={i} className={`report-card report-type-${r.type === 'friday_executive' ? 'friday' : 'nightly'}`} onClick={() => previewReport(r)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className={`badge ${r.type === 'friday_executive' ? 'gold' : 'blue'}`} style={{ fontSize: '10px' }}>{r.type === 'friday_executive' ? '📋 Friday Executive' : '📊 Nightly'}</span>
          <span className="fs-10 text-muted">{r.date}</span>
        </div>
        <div className="fs-12 fw-600 mb-12">{r.title}</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span className="fs-11 text-muted"><strong className="text-gold font-mono">{r.qa}</strong> Avg QA</span>
          <span className="fs-11 text-muted"><strong className="text-green font-mono">{r.enrolls}</strong> Enrolled</span>
          <span className="fs-11 text-muted"><strong className="font-mono">{r.calls}</strong> Calls</span>
        </div>
      </div>
    ));
  };

  const renderPIPCards = () => {
    const pips = [
      { agent: 'Jose Saldana', dept: 'SDR', reason: 'QA avg 41.1% over 3 consecutive days (threshold: 45%)', day: 11, target: 'QA ≥ 55% by Day 14', manager: 'Floor Manager', color: 'var(--orange)' },
      { agent: 'Amber Thurmond', dept: 'Jr Closer', reason: 'CD02 disclosure failure + bad tracker triggered on same day', day: 6, target: 'Zero disclosure failures + QA ≥ 50%', manager: 'Floor Manager', color: 'var(--red)' },
    ];
    return pips.map((p, i) => {
      const pct = (p.day / 14) * 100;
      const barColor = p.day >= 12 ? 'var(--red)' : p.day >= 7 ? 'var(--orange)' : 'var(--gold)';
      const decision = p.day >= 14 ? 'SEPARATE' : p.day >= 7 ? 'REVIEW' : 'WATCH';
      return (
        <div key={i} className={`pip-card level-${p.day >= 12 ? 'exec' : p.day >= 7 ? 'final' : 'pip'}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div className="fs-13 fw-700" style={{ color: 'var(--text)' }}>{p.agent}</div>
              <div className="fs-11 text-muted">{p.dept} · Day {p.day} of 14</div>
            </div>
            <span className={`decision-badge ${decision}`}>{decision === 'SEPARATE' ? '❌ Decision Required' : decision === 'REVIEW' ? '🔴 Review' : '⚠️ Watch'}</span>
          </div>
          <div className="fs-11 text-muted mb-12" style={{ padding: '8px', background: 'var(--bg3)', borderRadius: 'var(--radius)', lineHeight: '1.5' }}>{p.reason}</div>
          <div className="flex items-center gap-8 mb-12">
            <span className="fs-10 text-muted">Target:</span>
            <span className="fs-11" style={{ color: 'var(--text)' }}>{p.target}</span>
          </div>
          <div className="pip-progress">
            <div className="fs-10 text-muted" style={{ minWidth: '40px' }}>Day {p.day}</div>
            <div className="pip-days-track"><div className="pip-days-fill" style={{ width: `${pct}%`, background: barColor }}></div></div>
            <div className="fs-10 text-muted">Day 14</div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
            <button className="filter-btn" style={{ fontSize: '11px' }} onClick={() => showToast('info', 'PIP Log', 'Loading daily coaching log...', setToasts)}>📋 Daily Log</button>
            <button className="filter-btn" style={{ fontSize: '11px' }} onClick={() => showToast('info', 'PIP Actions', 'Opening resolution options...', setToasts)}>⚡ Actions</button>
          </div>
        </div>
      );
    });
  };

  const renderAcademyCallList = () => {
    let calls = academyCalls;
    if (academyFilter !== 'all') calls = calls.filter(c => c.academyTag === academyFilter);
    if (academyDept) calls = calls.filter(c => c.agentDept === academyDept);
    if (academyMarker) calls = calls.filter(c => c.markers.some(m => m.label === academyMarker));

    const ex = academyCalls.filter(c => c.academyTag === 'exemplar').length;
    const ft = academyCalls.filter(c => c.academyTag === 'featured').length;
    const wn = academyCalls.filter(c => c.academyTag === 'warning').length;

    return (
      <>
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <div style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '18px' }}>{ex}</div><div className="fs-10 text-muted uppercase">Exemplar</div></div>
          <div style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}><div className="font-mono fw-700 text-gold" style={{ fontSize: '18px' }}>{ft}</div><div className="fs-10 text-muted uppercase">Featured</div></div>
          <div style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}><div className="font-mono fw-700 text-red" style={{ fontSize: '18px' }}>{wn}</div><div className="fs-10 text-muted uppercase">Warning</div></div>
          <div style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', textAlign: 'center' }}><div className="font-mono fw-700" style={{ fontSize: '18px' }}>{academyCalls.length}</div><div className="fs-10 text-muted uppercase">Total Tagged</div></div>
          <div style={{ padding: '10px 20px', flex: 1, display: 'flex', alignItems: 'center' }}>
            <div className="fs-11 text-muted" style={{ lineHeight: '1.5' }}>
              analytiq auto-surfaces the <strong className="text-green">top 10%</strong> and <strong className="text-red">bottom 10%</strong> scoring calls every night for training review.
              Tag calls with timestamp markers to build a reusable training library for City Financial.
            </div>
          </div>
        </div>
        <div id="academy-call-list" style={{ padding: '14px' }}>
          {calls.map(c => {
            const color = agentColor(c.agentIdx);
            const scCol = scoreColor(c.score);
            const tagCls = c.academyTag;
            const tagLabels = { exemplar: '⭐ Exemplar', featured: '🎯 Featured', warning: '⚠️ Warning' };

            // Build waveform (60 segments)
            const segs = Array.from({ length: 60 }, (_, i) => {
              const h = Math.round(20 + Math.random() * 80);
              const markerHere = c.markers.find(m => {
                const totalSec = parseInt(c.duration.split(':')[0]) * 60 + parseInt(c.duration.split(':')[1]);
                const [mm, ss] = m.time.split(':').map(Number);
                const markerPos = Math.round(((mm * 60 + ss) / totalSec) * 60);
                return Math.abs(markerPos - i) <= 1;
              });
              const cls = markerHere ? `wave-seg marker-${markerHere.color}` : 'wave-seg';
              return <div key={i} className={cls} style={{ height: `${h}%` }}></div>;
            });

            const markersHtml = c.markers.map(m => (
              <div key={m.id} className={`marker-pill ${m.color}`} onClick={(e) => { e.stopPropagation(); showToast('info', `Jump to ${m.time}`, `Playing: ${m.label}`, setToasts); }}>
                <span>{m.color === 'green' ? '●' : m.color === 'red' ? '●' : '◆'}</span> {m.time} · {m.label}
              </div>
            ));

            return (
              <div key={c.id} className={`call-card-academy ${tagCls}`} onClick={() => openScorecard(c)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials(c.agentName)}</div>
                    <div>
                      <div className="fs-12 fw-700" style={{ color: 'var(--text)' }}>{c.agentName}</div>
                      <div className="fs-10 text-muted">{c.agentDept} · {c.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {c.duration} · {c.campaign.split('—')[0].trim()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span className={`academy-tag ${tagCls}`}>{tagLabels[tagCls]}</span>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: 700, color: scCol, minWidth: '36px', textAlign: 'right' }}>{c.score}</div>
                  </div>
                </div>

                {/* Waveform */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div className="waveform-bar" style={{ flex: 1 }}>{segs}</div>
                    <button style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: '50%', width: '28px', height: '28px', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); showToast('info', 'Playing Recording', 'Opening call recording...', setToasts); }}>▶</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="fs-10 text-muted font-mono">0:00</span>
                    <span className="fs-10 text-muted font-mono">{c.duration}</span>
                  </div>
                </div>

                {/* Markers */}
                <div className="marker-list">{markersHtml}</div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <span className="fs-10 text-muted">{c.collection}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                    <button className="filter-btn" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); showToast('info', 'Tag Call', 'Select: Exemplar · Featured · Warning', setToasts); }}>+ Tag</button>
                    <button className="filter-btn" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); showToast('info', 'Add Timestamp Marker', 'Enter timestamp and label for training marker.', setToasts); }}>⏱ Marker</button>
                    <button className="filter-btn" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); showToast('info', 'Add to Collection', 'Select a training collection to add this call to.', setToasts); }}>📁 Add to Collection</button>
                  </div>
                </div>
              </div>
            );
          })}
          {calls.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <div>No calls match this filter.</div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderSDRCards = () => {
    const agents = sdrFilter === 'all' ? sdrAgents : sdrAgents.filter(a =>
      (sdrFilter === 'ready' && a.status === 'READY') ||
      (sdrFilter === 'watch' && a.status === 'WATCH') ||
      (sdrFilter === 'not-yet' && a.status === 'NOT_YET') ||
      (sdrFilter === 'promoted' && a.status === 'PROMOTED')
    );

    const counts = {
      total: sdrAgents.length,
      ready: sdrAgents.filter(a => a.status === 'READY').length,
      watch: sdrAgents.filter(a => a.status === 'WATCH').length,
      notYet: sdrAgents.filter(a => a.status === 'NOT_YET').length,
      promoted: sdrAgents.filter(a => a.status === 'PROMOTED').length,
    };

    const statusSort = { READY: 0, WATCH: 1, NOT_YET: 2, PROMOTED: 3 };
    const sorted = [...agents].sort((a, b) => statusSort[a.status] - statusSort[b.status] || b.readiness - a.readiness);

    return (
      <>
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <div style={{ padding: '12px 24px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer' }} onClick={() => sdrStageFilter('all')}>
            <div className="font-mono fw-700" style={{ fontSize: '22px' }}>{counts.total}</div>
            <div className="fs-10 text-muted uppercase">Total SDRs</div>
          </div>
          <div style={{ padding: '12px 24px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer' }} onClick={() => sdrStageFilter('ready')}>
            <div className="font-mono fw-700 text-green" style={{ fontSize: '22px' }}>{counts.ready}</div>
            <div className="fs-10 text-muted uppercase">✅ Ready</div>
          </div>
          <div style={{ padding: '12px 24px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer' }} onClick={() => sdrStageFilter('watch')}>
            <div className="font-mono fw-700 text-gold" style={{ fontSize: '22px' }}>{counts.watch}</div>
            <div className="fs-10 text-muted uppercase">⚠️ Watch</div>
          </div>
          <div style={{ padding: '12px 24px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer' }} onClick={() => sdrStageFilter('not-yet')}>
            <div className="font-mono fw-700 text-muted" style={{ fontSize: '22px' }}>{counts.notYet}</div>
            <div className="fs-10 text-muted uppercase">🕐 Not Yet</div>
          </div>
          <div style={{ padding: '12px 24px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer' }} onClick={() => sdrStageFilter('promoted')}>
            <div className="font-mono fw-700" style={{ fontSize: '22px', color: 'var(--purple)' }}>{counts.promoted}</div>
            <div className="fs-10 text-muted uppercase">⭐ Promoted</div>
          </div>
          <div style={{ flex: 1, padding: '10px 20px', display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <div className={`stage-pillar active`} onClick={() => showStageDetail(1)}><div className="stage-num text-muted">{sdrAgents.filter(a => a.day <= 7 && a.status !== 'PROMOTED').length}</div><div className="stage-label">Week 1<br />Observe</div></div>
            <div className={`stage-pillar`} onClick={() => showStageDetail(2)}><div className="stage-num text-muted">{sdrAgents.filter(a => a.day > 7 && a.day < 14 && a.status !== 'PROMOTED').length}</div><div className="stage-label">Week 2<br />Qualify</div></div>
            <div className={`stage-pillar`} onClick={() => showStageDetail(3)}><div className="stage-num text-gold">{sdrAgents.filter(a => a.day >= 14 && a.status !== 'PROMOTED').length}</div><div className="stage-label">Eval<br />Gate</div></div>
            <div className={`stage-pillar`} onClick={() => showStageDetail(4)}><div className="stage-num" style={{ color: 'var(--purple)' }}>{counts.promoted}</div><div className="stage-label">Closer<br />Track</div></div>
          </div>
        </div>

        <div id="sdr-cards" style={{ padding: '14px' }}>
          {sorted.map(a => {
            const cardCls = a.status === 'READY' ? 'ready' : a.status === 'WATCH' ? 'watch' : a.status === 'PROMOTED' ? 'promoted' : 'not-yet';
            const ringColor = a.readiness >= 72 ? 'var(--green)' : a.readiness >= 55 ? 'var(--gold)' : 'var(--border3)';
            const r = a.readiness;
            const circ = 2 * Math.PI * 22;
            const dash = (r / 100) * circ;

            const dimRows = [
              { name: 'QA Score Avg', val: a.dims.qaDim, raw: `${a.qa}`, col: scoreColor(a.qa) },
              { name: 'Disclosure Rate', val: a.dims.discDim, raw: `${a.discAdh}%`, col: a.discAdh >= 80 ? 'var(--green)' : a.discAdh >= 60 ? 'var(--gold)' : 'var(--red)' },
              { name: 'Talk Ratio', val: a.dims.talkDim, raw: `${a.talkRatio}%`, col: a.talkRatio <= 55 ? 'var(--green)' : a.talkRatio <= 65 ? 'var(--gold)' : 'var(--red)' },
              { name: 'Bad Trackers', val: a.dims.badDim, raw: `${a.badTrack}`, col: a.badTrack === 0 ? 'var(--green)' : a.badTrack <= 2 ? 'var(--gold)' : 'var(--red)' },
              { name: 'Objections Handled', val: a.dims.objDim, raw: `${a.objRate}`, col: a.objRate >= 3 ? 'var(--green)' : 'var(--text3)' },
            ].map(d => (
              <div key={d.name} className="dim-bar-row">
                <div className="dim-name">{d.name}</div>
                <div className="dim-bar-track"><div className="dim-bar-fill" style={{ width: `${d.val}%`, background: d.col }}></div></div>
                <div className="dim-val" style={{ color: d.col }}>{d.raw}</div>
              </div>
            ));

            return (
              <div key={a.name} className={`sdr-card ${cardCls}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div className="readiness-ring" style={{ flexShrink: 0 }}>
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bg4)" strokeWidth="6" />
                      <circle cx="28" cy="28" r="22" fill="none" stroke={ringColor} strokeWidth="6"
                        strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
                        transform="rotate(-90 28 28)" style={{ transition: 'strokeDasharray 0.5s ease' }} />
                    </svg>
                    <div className="readiness-val">
                      <div className="readiness-num" style={{ color: ringColor }}>{r}</div>
                      <div className="readiness-label">Ready</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: a.agentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials(a.name)}</div>
                      <span className="fs-13 fw-700" style={{ color: 'var(--text)' }}>{a.name}</span>
                      <span className={`promo-badge ${a.status}`} style={{ marginLeft: 'auto' }}>{a.status === 'READY' ? '✅ READY' : a.status === 'WATCH' ? '⚠️ WATCH' : a.status === 'PROMOTED' ? '⭐ PROMOTED' : '🕐 NOT YET'}</span>
                    </div>
                    <div className="fs-11 text-muted">Day <strong className="font-mono" style={{ color: 'var(--text)' }}>{a.day}</strong> of 14 · {a.dept} · {a.calls} calls · Score trend: <span style={{ color: a.trend === 'up' ? 'var(--green)' : 'var(--text3)' }}>{a.trend === 'up' ? '↑ improving' : '→ flat'}</span></div>
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>{dimRows}</div>
                <div className="pip-progress">
                  <div className="fs-10 text-muted" style={{ minWidth: '40px' }}>Day {a.day}</div>
                  <div className="pip-days-track">
                    <div className="pip-days-fill" style={{ width: `${(a.day / 14) * 100}%`, background: ringColor }}></div>
                  </div>
                  <div className="fs-10 text-muted">Day 14</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {a.status === 'READY' && <button className="modal-btn primary" style={{ padding: '5px 12px', fontSize: '11px', borderRadius: 'var(--radius)' }} onClick={() => showPromoteModal(a.name)}>🚀 Promote</button>}
                  <button className="filter-btn" style={{ fontSize: '11px' }} onClick={() => showToast('info', 'Call History', `Opening ${a.name} call history...`, setToasts)}>📞 Calls</button>
                  <button className="filter-btn" style={{ fontSize: '11px' }} onClick={() => showToast('info', 'Academy Match', `Finding best training calls for ${a.name}...`, setToasts)}>🎓 Academy Match</button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderSDRTable = () => {
    const agents = sdrFilter === 'all' ? sdrAgents : sdrAgents.filter(a =>
      (sdrFilter === 'ready' && a.status === 'READY') ||
      (sdrFilter === 'watch' && a.status === 'WATCH') ||
      (sdrFilter === 'not-yet' && a.status === 'NOT_YET') ||
      (sdrFilter === 'promoted' && a.status === 'PROMOTED')
    );

    const statusSort = { READY: 0, WATCH: 1, NOT_YET: 2, PROMOTED: 3 };
    const sorted = [...agents].sort((a, b) => statusSort[a.status] - statusSort[b.status] || b.readiness - a.readiness);

    return (
      <div style={{ overflowX: 'auto', padding: '14px' }}>
        <table className="data-table" style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th>SDR</th><th>Day</th><th>Readiness</th>
              <th>QA Avg</th><th>Disc. Adherence</th><th>Talk Ratio</th>
              <th>Objection Rate</th><th>Enrollments</th><th>Calls</th>
              <th>Last Score</th><th>Trend</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(a => (
              <tr key={a.name}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: a.agentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#000' }}>{initials(a.name)}</div>
                  <span className="fw-600 fs-12">{a.name}</span>
                </div></td>
                <td className="mono">{a.day}/14</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: a.readiness >= 72 ? 'var(--green-dim)' : a.readiness >= 55 ? 'var(--gold-dim)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: a.readiness >= 72 ? 'var(--green)' : a.readiness >= 55 ? 'var(--gold)' : 'var(--text3)' }}>{a.readiness}</div></div></td>
                <td className={`mono ${scoreClass(a.qa) === 'great' ? 'score-great' : scoreClass(a.qa) === 'ok' ? 'score-ok' : 'score-bad'}`}>{a.qa}</td>
                <td className={`mono ${a.discAdh >= 80 ? 'text-green' : a.discAdh >= 60 ? 'text-gold' : 'text-red'}`}>{a.discAdh}%</td>
                <td className={`mono ${a.talkRatio <= 55 ? 'text-green' : a.talkRatio <= 65 ? 'text-gold' : 'text-red'}`}>{a.talkRatio}%</td>
                <td className="mono">{a.objRate}</td>
                <td className="mono text-green">{a.enrolls}</td>
                <td className="mono">{a.calls}</td>
                <td className="mono">{a.lastScore}</td>
                <td style={{ color: a.trend === 'up' ? 'var(--green)' : 'var(--text3)' }}>{a.trend === 'up' ? '↑' : '→'}</td>
                <td><span className={`promo-badge ${a.status}`} style={{ fontSize: '9px' }}>{a.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSDRStrategy = () => {
    return (
      <div style={{ maxWidth: '860px', padding: '14px' }}>
        <div style={{ background: 'linear-gradient(135deg,var(--bg3) 0%,var(--bg4) 100%)', border: '1px solid var(--border2)', borderRadius: 'var(--radius2)', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '28px' }}>🎯</div>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>The SDR → Sales Ninja Blueprint</div>
              <div className="fs-11 text-muted">City Financial · 14-Day Conversion System</div>
            </div>
          </div>
          <div className="fs-12 text-muted" style={{ lineHeight: '1.7', borderLeft: '3px solid var(--gold)', paddingLeft: '12px' }}>
            Your SDRs have one job: qualify aggressively and hand off hot. The best SDRs already show closing instincts — they handle early objections, control pacing, and build instant rapport.
            This system identifies which ones are doing that organically, puts them on a structured 14-day evaluation track, and gates promotion on hard data — not gut feel.
          </div>
        </div>

        <div className="fs-11 fw-600 text-muted uppercase mb-12" style={{ letterSpacing: '0.08em' }}>The 4-Phase Promotion Track</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {/* Phase 1 */}
          <div style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius2)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg3)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg4)', border: '2px solid var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text3)' }}>1</div>
              <div><div className="fs-12 fw-700">Week 1 — Observe & Baseline</div><div className="fs-10 text-muted">Days 1–7 · No pressure, just data</div></div>
              <span className="badge grey" style={{ marginLeft: 'auto' }}>Days 1–7</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div className="fs-11 fw-600 mb-12">📊 What we're measuring</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li>QA score trajectory (going up or flat?)</li>
                    <li>Disclosure adherence rate (CD01–CD05)</li>
                    <li>Talk-to-listen ratio (target: ≤55% agent)</li>
                    <li>Number of calls handled per day</li>
                    <li>How many get to qualifying questions</li>
                  </ul>
                </div>
                <div>
                  <div className="fs-11 fw-600 mb-12">🎯 Coaching focus</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li>Daily 1:1 script review (10 min max)</li>
                    <li>Listen to 2 of their calls together daily</li>
                    <li>Academy: Play 1 exemplar call per day</li>
                    <li>Zero tolerance on disclosure skips</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2 */}
          <div style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius2)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg3)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--gold-dim)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--gold)' }}>2</div>
              <div><div className="fs-12 fw-700">Week 2 — Qualify Hard</div><div className="fs-10 text-muted">Days 8–14 · Push them to the edge of their skillset</div></div>
              <span className="badge gold" style={{ marginLeft: 'auto' }}>Days 8–14</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div className="fs-11 fw-600 mb-12">📊 Readiness signals we look for</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li>QA avg ≥ 65 in days 10–14</li>
                    <li>Objection handling — do they stay calm?</li>
                    <li>Do they ask for the enrollment unprompted?</li>
                    <li>Disclosure score ≥ 80% (CD01–CD05)</li>
                    <li>Zero bad trackers in last 5 calls</li>
                  </ul>
                </div>
                <div>
                  <div className="fs-11 fw-600 mb-12">🎯 Deliberate challenges</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li>Give them 1 warm transfer to attempt close</li>
                    <li>Role-play the 5 hardest objections (live)</li>
                    <li>Shadow a top closer for 1 full shift</li>
                    <li>Academy: Review their own worst call</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 3 */}
          <div style={{ border: '1px solid rgba(46,204,142,0.3)', borderRadius: 'var(--radius2)', overflow: 'hidden', background: 'var(--green-dim)' }}>
            <div style={{ background: 'rgba(46,204,142,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(46,204,142,0.2)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--green-dim)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--green)' }}>3</div>
              <div><div className="fs-12 fw-700 text-green">Day 14 — The Evaluation Gate</div><div className="fs-10 text-muted">Hard data decision. No extensions.</div></div>
              <span className="badge green" style={{ marginLeft: 'auto' }}>Day 14</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div className="fs-11 fw-600 mb-12">✅ Promotion criteria (must pass ALL)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>65+</div><div className="fs-10 text-muted">QA Avg<br />Days 10–14</div></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>80%</div><div className="fs-10 text-muted">Disclosure<br />Adherence</div></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>0</div><div className="fs-10 text-muted">Bad Trackers<br />Last 5 Calls</div></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>↑</div><div className="fs-10 text-muted">Score<br />Trending Up</div></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>≤55%</div><div className="fs-10 text-muted">Talk-to-Listen<br />Ratio</div></div>
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center', border: '1px solid rgba(46,204,142,0.2)' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>1+</div><div className="fs-10 text-muted">Close Attempt<br />In 14 Days</div></div>
              </div>
              <div style={{ marginTop: '12px', padding: '10px', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid rgba(232,160,32,0.2)' }}>
                <div className="fs-11 text-gold fw-600">⚠️ What happens if they don't pass?</div>
                <div className="fs-11 text-muted" style={{ marginTop: '4px', lineHeight: '1.6' }}>Reset the clock. Give them 1 more 14-day cycle. If they fail the second gate — they stay SDR. Don't extend indefinitely; two cycles is the limit. Protect the closer floor.</div>
              </div>
            </div>
          </div>

          {/* Phase 4 */}
          <div style={{ border: '1px solid rgba(155,108,240,0.3)', borderRadius: 'var(--radius2)', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(155,108,240,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(155,108,240,0.2)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--purple-dim)', border: '2px solid var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--purple)' }}>4</div>
              <div><div className="fs-12 fw-700" style={{ color: 'var(--purple)' }}>Closer Track — Ramp Protocol</div><div className="fs-10 text-muted">First 30 days as a closer. Don't throw them to the wolves.</div></div>
              <span className="badge purple" style={{ marginLeft: 'auto' }}>Post-Promo</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div className="fs-11 fw-600 mb-12">🏗️ Ramp structure</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li><strong>Days 1–5:</strong> Shadow a top closer (no live calls)</li>
                    <li><strong>Days 6–10:</strong> Warm transfers only (pre-qualified)</li>
                    <li><strong>Days 11–20:</strong> Live calls with floor manager monitoring</li>
                    <li><strong>Day 21+:</strong> Full closer rotation — judged on close rate</li>
                  </ul>
                </div>
                <div>
                  <div className="fs-11 fw-600 mb-12">📊 30-day success metrics</div>
                  <ul style={{ paddingLeft: '16px', color: 'var(--text2)', fontSize: '11px', lineHeight: '2' }}>
                    <li>Close rate ≥ 3% (same as floor avg)</li>
                    <li>QA avg ≥ 70 (raised bar from SDR level)</li>
                    <li>Zero disclosure fails in first 30 days</li>
                    <li>Avg deal value ≥ $3,500</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The signal table */}
        <div className="panel" style={{ marginBottom: '16px' }}>
          <div className="panel-hdr"><span className="panel-title">🧠 The 6 Readiness Signals — Weighted by Impact</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Signal</th><th>Weight</th><th>Ready Threshold</th><th>Watch Zone</th><th>Not Yet</th><th>Why It Matters</th></tr>
              </thead>
              <tbody>
                <tr><td className="fw-600">QA Score Trajectory</td><td className="mono text-gold">30%</td><td className="text-green">Avg ≥ 65 (last 5 days)</td><td className="text-gold">Avg 50–64</td><td className="text-red">Avg &lt; 50</td><td className="text-muted fs-11">Core indicator of process mastery</td></tr>
                <tr><td className="fw-600">Disclosure Adherence</td><td className="mono text-gold">25%</td><td className="text-green">CD01–CD05 ≥ 80%</td><td className="text-gold">60–79%</td><td className="text-red">&lt; 60%</td><td className="text-muted fs-11">Compliance first — can't close if they can't disclose</td></tr>
                <tr><td className="fw-600">Talk-to-Listen Ratio</td><td className="mono text-gold">15%</td><td className="text-green">Agent ≤ 55% talk time</td><td className="text-gold">56–65%</td><td className="text-red">&gt; 65%</td><td className="text-muted fs-11">Great closers listen more than they talk</td></tr>
                <tr><td className="fw-600">Bad Tracker Rate</td><td className="mono text-gold">15%</td><td className="text-green">0 in last 5 calls</td><td className="text-gold">1–2 in last 10</td><td className="text-red">Any in last 5</td><td className="text-muted fs-11">One bad tracker on a closer call = $0 deal + liability</td></tr>
                <tr><td className="fw-600">Objection Handling</td><td className="mono text-gold">10%</td><td className="text-green">Handled calmly ≥ 3×</td><td className="text-gold">1–2×</td><td className="text-red">0 or panicked</td><td className="text-muted fs-11">Closers live on objections. SDRs run from them.</td></tr>
                <tr><td className="fw-600">Call Volume</td><td className="mono text-gold">5%</td><td className="text-green">≥ 25 calls / 2 weeks</td><td className="text-gold">15–24</td><td className="text-red">&lt; 15</td><td className="text-muted fs-11">Not enough reps = not enough data to evaluate</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderModalContent = () => {
    if (!selectedCall) return null;
    const call = selectedCall;

    if (modalTab === 'overview') {
      const strengths = CHECKPOINTS_ALL.flatMap(cat => cat.items).filter(() => Math.random() > 0.6).slice(0, 3).map(cp => `<li>${cp.text}</li>`).join('');
      const improvements = CHECKPOINTS_ALL.flatMap(cat => cat.items).filter(() => Math.random() > 0.7).slice(0, 3).map(cp => `<li style="color:var(--red)">${cp.text}</li>`).join('');
      return (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div className="fs-12 fw-600 text-muted uppercase mb-12" style={{ letterSpacing: '0.06em' }}>Score Breakdown</div>
            <div className="grid-3" style={{ gap: '8px', marginBottom: '12px' }}>
              <div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-600 text-gold" style={{ fontSize: '18px' }}>{Math.round(call.score * 0.45)}%</div><div className="fs-10 text-muted">Call Quality</div></div>
              <div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-600 text-red" style={{ fontSize: '18px' }}>{Math.round(call.score * 0.40)}%</div><div className="fs-10 text-muted">Disclosures</div></div>
              <div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-600 text-blue" style={{ fontSize: '18px' }}>{Math.round(call.score * 0.15)}%</div><div className="fs-10 text-muted">Compliance</div></div>
            </div>
          </div>
          <div className="fs-12 fw-600 mb-12">✅ Strengths</div>
          <ul style={{ paddingLeft: '18px', marginBottom: '16px', color: 'var(--green)' }} dangerouslySetInnerHTML={{ __html: strengths }} />
          <div className="fs-12 fw-600 mb-12" style={{ color: 'var(--red)' }}>⚠️ Areas Needing Improvement</div>
          <ul style={{ paddingLeft: '18px', color: 'var(--text2)' }} dangerouslySetInnerHTML={{ __html: improvements }} />
        </>
      );
    }

    if (modalTab === 'trackers') {
      const trackersHtml = CHECKPOINTS_ALL.map(cat => {
        const items = cat.items.map(cp => {
          const r = Math.random();
          const result = r > 0.25 ? 'pass' : r > 0.1 ? 'fail' : 'na';
          return `<div className="tracker-item ${result}">
            <span className="tracker-icon">${result === 'pass' ? '✓' : result === 'fail' ? '✗' : '—'}</span>
            <span>${cp.text}</span>
            ${cp.autoFail && result === 'fail' ? '<span className="badge red" style="margin-left:auto;font-size:9px">AUTO-FAIL</span>' : ''}
            <span className="font-mono fs-10 text-muted" style="margin-left:auto">${cp.pts}pts</span>
          </div>`;
        }).join('');
        const passCount = cat.items.filter(() => Math.random() > 0.25).length;
        return `<div className="tracker-group">
          <div className="tracker-group-hdr">
            <span>${cat.cat}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span className="tracker-group-count">${passCount}/${cat.items.length} passed</span>
              <span className="text-muted">▾</span>
            </div>
          </div>
          <div className="tracker-group-body">${items}</div>
        </div>`;
      }).join('');

      const gtHtml = GOOD_TRACKERS.map(t => {
        const hit = Math.random() > 0.4;
        return `<div className="tracker-item ${hit ? 'good' : 'na'}"><span className="tracker-icon">${hit ? '✓' : '—'}</span><span>${t}</span></div>`;
      }).join('');
      const btHtml = BAD_TRACKERS.map(t => {
        const triggered = Math.random() > 0.85;
        return `<div className="tracker-item ${triggered ? 'bad' : 'na'}"><span className="tracker-icon">${triggered ? '✗' : '—'}</span><span>${t}</span>${triggered ? '<span className="badge red" style="margin-left:auto;font-size:9px">🚨 TRIGGERED</span>' : ''}</div>`;
      }).join('');

      return (
        <div dangerouslySetInnerHTML={{
          __html: trackersHtml + `
          <div className="tracker-group">
            <div className="tracker-group-hdr">Good Trackers<span className="tracker-group-count">Agent</span></div>
            <div className="tracker-group-body">${gtHtml}</div>
          </div>
          <div className="tracker-group">
            <div className="tracker-group-hdr" style="color:var(--red)">Bad Trackers<span className="tracker-group-count" style="color:var(--red)">CRITICAL — Agent</span></div>
            <div className="tracker-group-body">${btHtml}</div>
          </div>`
        }} />
      );
    }

    if (modalTab === 'ai-coach') {
      const insights = [
        { icon: '🎯', text: `<strong>Discovery gap detected:</strong> Agent did not ask all required qualifying questions. Missing: income verification and bankruptcy check. These are required for every call and affect downstream eligibility.` },
        { icon: '🗣️', text: `<strong>Talk ratio imbalance:</strong> Agent spoke 68% of the call. Ideal ratio is 50-55% agent / 45-50% client. Slow down, ask more open-ended questions, and let the prospect share more.` },
        { icon: '⚡', text: `<strong>Pacing issue:</strong> Call duration was ${call.duration}. Disclosures were rushed in the final 2 minutes. Disclosures must be delivered clearly and confirmed understood — not speed-read at the end.` },
        { icon: '💡', text: `<strong>Strength noted:</strong> Agent used empathy effectively in the opening rapport section. The acknowledgment of the client's financial stress felt genuine and built trust quickly.` },
      ];
      const actions = [
        '1. Review the disclosure checklist before your next call — CD01-CD05 are mandatory and auto-fail',
        '2. Practice the qualifying flow: debt amount → income → bankruptcy → bank account → goal',
        '3. Target 50/50 talk-to-listen ratio — set a timer, stop talking after 3 sentences, ask a question',
      ];
      return (
        <>
          <div className="fs-11 text-muted mb-16" style={{ padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', lineHeight: '1.5' }}>AI-generated coaching based on checkpoint performance, talk ratio, and deviation patterns detected on this call.</div>
          {insights.map((i, idx) => (
            <div key={idx} className="ai-insight"><span className="ai-insight-icon">{i.icon}</span><div className="ai-insight-text" dangerouslySetInnerHTML={{ __html: i.text }} /></div>
          ))}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div className="fs-12 fw-600 mb-12">Coaching Priority Actions</div>
            {actions.map((a, idx) => <div key={idx} style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.5' }}>{a}</div>)}
          </div>
        </>
      );
    }

    if (modalTab === 'summary') {
      return (
        <div>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '14px' }}>
            <div className="fs-12 fw-600 mb-12">Call Overview</div>
            <div className="fs-12 text-muted" style={{ lineHeight: '1.7' }}>
              Agent {call.agentName} connected with {call.client || 'the prospect'} on {call.date.toLocaleDateString()}.
              The call lasted {call.duration} and was classified as <strong>{call.outcome}</strong>.
              The agent scored {call.score} out of 100 on the QA scorecard.
              {call.flags.length > 0 ? ` Deviations flagged: ${call.flags.join(', ')}.` : ' No deviations flagged.'}
              Campaign source: {call.campaign}. Lead source: {call.leadSource} (Sub ID: {call.subId}).
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="panel" style={{ padding: '10px' }}><div className="fs-10 text-muted uppercase mb-12">Lead Source</div><div className="fs-12 fw-600">{call.leadSource}</div><div className="fs-10 text-muted">{call.subId}</div></div>
            <div className="panel" style={{ padding: '10px' }}><div className="fs-10 text-muted uppercase mb-12">Campaign</div><div className="fs-12 fw-600">{call.campaign}</div></div>
            <div className="panel" style={{ padding: '10px' }}><div className="fs-10 text-muted uppercase mb-12">Outcome</div><div className="fs-12 fw-600"><span className={`badge ${outcomeClass(call.outcome)}`}>{call.outcome}</span></div></div>
            <div className="panel" style={{ padding: '10px' }}><div className="fs-10 text-muted uppercase mb-12">Department</div><div className="fs-12 fw-600">{call.agentDept}</div></div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderAccountingPage = () => (
    <div className="kpi-page-content">
      <div className="kpi-grid kpi-grid-5 mb-16">
        <div className="kpi-card"><div className="kpi-card-label">Tax - AR Booked</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val lg">$1,186</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Tax - Remote Upsell</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Total Income - Tax</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">DL In-house Booked</div><div className="kpi-card-sub">Current week</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">In-house - Active</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0</div></div>
      </div>
      <div className="kpi-grid kpi-grid-5 mb-16">
        <div className="kpi-card">
          <div className="kpi-card-label">Tax - AR Billed</div><div className="kpi-card-sub">Today</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--blue)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val">$0</div><div className="kpi-card-sub">of $1,186</div></div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">MTD Billing Rate</div><div className="kpi-card-sub">Month to date</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--green)" strokeWidth="8" strokeDasharray="92 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val green">$124,085</div><div className="kpi-card-sub">of $136,125</div></div>
          </div>
        </div>
        <div className="kpi-card"><div className="kpi-card-label">Tax - Daily Costs</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0</div></div>
        <div className="kpi-card">
          <div className="kpi-card-label">DL In-House Billed</div><div className="kpi-card-sub">Current week</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--blue)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val">$0</div></div>
          </div>
        </div>
        <div className="kpi-card"><div className="kpi-card-label">In-house - NSF/RTC</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0</div></div>
      </div>
      <div className="kpi-grid kpi-grid-5 mb-16">
        <div className="kpi-card"><div className="kpi-card-label">Tax AR Defaulted</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Tax AR Defaulted</div><div className="kpi-card-sub">Current month</div><div className="kpi-card-val gold">$8,064</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Tax - Daily Net</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Debt Total Costs</div><div className="kpi-card-sub">Current week</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">In-house - Cancelled</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0</div></div>
      </div>
      <div className="kpi-grid kpi-grid-5">
        <div className="kpi-card">
          <div className="kpi-card-label">Recovery Cleared</div><div className="kpi-card-sub">Today</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--blue)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val">$0</div></div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Recovery Cleared</div><div className="kpi-card-sub">Current month</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--green)" strokeWidth="8" strokeDasharray="30 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val green">$21,181</div><div className="kpi-card-sub">of $6,064</div></div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Tax - MTD Net</div><div className="kpi-card-sub">Today</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--green)" strokeWidth="8" strokeDasharray="106 138" className="gauge-ring" /></svg>
            <div><div className="kpi-card-val green">$110,779</div><div className="kpi-card-sub">of 100,000</div></div>
          </div>
        </div>
        <div className="kpi-card"><div className="kpi-card-label">Debt Total Net</div><div className="kpi-card-sub">Current week</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Debt - MTD Net</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val green" style={{fontSize:'26px'}}>$0</div></div>
      </div>
    </div>
  );

  const renderDebtBoardPage = () => (
    <div className="kpi-page-content">
      <div className="kpi-grid kpi-grid-4 mb-16">
        <div className="kpi-card">
          <div className="kpi-card-label">Daily Approved Deals</div><div className="kpi-card-sub">Today</div>
          <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="none" stroke="var(--bg4)" strokeWidth="9" /><circle cx="35" cy="35" r="26" fill="none" stroke="var(--blue)" strokeWidth="9" strokeDasharray="0 163" className="gauge-ring" /></svg>
          <div className="kpi-card-val" style={{ marginTop: '-8px' }}>0</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Monthly Approved Deals</div><div className="kpi-card-sub">Current month</div>
          <div className="kpi-card-val gold lg">194</div>
          <div className="kpi-card-sub">Goal: 200</div>
        </div>
        <div className="kpi-card"><div className="kpi-card-label">Avg. per rep</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">0.0</div><div className="kpi-card-sub">Goal: 1</div></div>
        <div className="kpi-card"><div className="kpi-card-label">Avg. Cordoba Enrolled</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">$0</div><div className="kpi-card-sub">of 23,000</div></div>
      </div>
    </div>
  );

  const renderFinanceBoardPage = () => (
    <div className="kpi-page-content">
      <div className="grid-2 mb-16">
        <div>
          <div className="kpi-grid kpi-grid-3 mb-12">
            <div className="kpi-card">
              <div className="kpi-card-label">Daily Funded Amount</div><div className="kpi-card-sub">Today</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="none" stroke="var(--bg4)" strokeWidth="9" /><circle cx="35" cy="35" r="26" fill="none" stroke="var(--blue)" strokeWidth="9" strokeDasharray="0 163" className="gauge-ring" /></svg>
                <div><div className="kpi-card-val">$0</div><div className="kpi-card-sub">of $20,000</div></div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">WTD Total Funded</div><div className="kpi-card-sub">Current week</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="none" stroke="var(--bg4)" strokeWidth="9" /><circle cx="35" cy="35" r="26" fill="none" stroke="var(--blue)" strokeWidth="9" strokeDasharray="0 163" className="gauge-ring" /></svg>
                <div><div className="kpi-card-val">$0</div><div className="kpi-card-sub">of $100,000</div></div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">MTD Total Funded</div><div className="kpi-card-sub">Current month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="none" stroke="var(--bg4)" strokeWidth="9" /><circle cx="35" cy="35" r="26" fill="none" stroke="var(--blue)" strokeWidth="9" strokeDasharray="0 163" className="gauge-ring" /></svg>
                <div><div className="kpi-card-val">$0</div><div className="kpi-card-sub">of $400,000</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBbbPage = () => (
    <div className="kpi-page-content">
      <div className="grid-2">
        <div>
          <div className="fs-10 uppercase fw-600 text-muted mb-12" style={{ letterSpacing: '0.08em' }}>CityTax</div>
          <div className="kpi-grid kpi-grid-2">
            <div className="kpi-card"><div className="kpi-card-label">CityTax Total Reviews</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">1</div></div>
            <div className="kpi-card"><div className="kpi-card-label">CityTax Pending</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">CityTax Responded</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">1</div></div>
            <div className="kpi-card"><div className="kpi-card-label">CityTax Resolved</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val green lg">1</div></div>
          </div>
        </div>
        <div>
          <div className="fs-10 uppercase fw-600 text-muted mb-12" style={{ letterSpacing: '0.08em' }}>UTD</div>
          <div className="kpi-grid kpi-grid-2">
            <div className="kpi-card"><div className="kpi-card-label">UTD Total Reviews</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">17</div></div>
            <div className="kpi-card"><div className="kpi-card-label">UTD Pending</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">UTD Responded</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val lg">17</div></div>
            <div className="kpi-card"><div className="kpi-card-label">UTD Resolved</div><div className="kpi-card-sub">All time</div><div className="kpi-card-val green lg">17</div></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMarketingPage = () => (
    <div className="kpi-page-content">
      <div className="kpi-card mb-16" style={{ textAlign: 'center' }}>
        <div className="kpi-card-label">TI Deals</div><div className="kpi-card-sub">Today</div>
        <svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="none" stroke="var(--bg4)" strokeWidth="10" /><circle cx="40" cy="40" r="30" fill="none" stroke="var(--red)" strokeWidth="10" strokeDasharray="0 188" className="gauge-ring" /></svg>
        <div className="kpi-card-val lg" style={{ marginTop: '-8px' }}>0</div>
      </div>
      <div className="kpi-grid kpi-grid-4 mb-16">
        <div className="kpi-card">
          <div className="kpi-card-label">Tax Gold CPS</div><div className="kpi-card-sub">Today</div>
          <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="none" stroke="var(--bg4)" strokeWidth="9" /><circle cx="35" cy="35" r="26" fill="none" stroke="var(--blue)" strokeWidth="9" strokeDasharray="0 163" className="gauge-ring" /></svg>
          <div className="kpi-card-val" style={{ marginTop: '-8px' }}>0</div>
        </div>
        <div className="kpi-card"><div className="kpi-card-label">Tax Gold CPA</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val">$0</div></div>
        <div className="kpi-card"><div className="kpi-card-label">TAX ACL</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val font-mono" style={{ fontSize: '18px' }}>Total<br />0.00</div></div>
        <div className="kpi-card">
          <div className="kpi-card-label">Tax Calls Answered</div><div className="kpi-card-sub">Today</div>
          <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--blue)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
          <div className="kpi-card-val" style={{ marginTop: '-6px' }}>0</div>
        </div>
      </div>
    </div>
  );

  const renderTaxDebtBackendPage = () => (
    <div className="kpi-page-content">
      <div className="grid-2">
        <div>
          <div className="kpi-grid kpi-grid-2 mb-12">
            <div className="kpi-card">
              <div className="kpi-card-label">Debt CS Missed Call</div><div className="kpi-card-sub">Today</div>
              <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--blue)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
              <div className="kpi-card-val" style={{ marginTop: '-6px' }}>0</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">Debt CS Inbound Connected</div><div className="kpi-card-sub">Today</div>
              <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--bg4)" strokeWidth="8" /><circle cx="30" cy="30" r="22" fill="none" stroke="var(--green)" strokeWidth="8" strokeDasharray="0 138" className="gauge-ring" /></svg>
              <div className="kpi-card-val green" style={{ marginTop: '-6px' }}>0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTaxPrepPage = () => (
    <div className="kpi-page-content">
      <div className="grid-2">
        <div>
          <div className="panel mb-12">
            <div className="panel-hdr"><span className="panel-title">Investigation</span></div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Team</th><th>Num</th><th>Diff</th><th>Sort</th></tr></thead>
              <tbody><tr><td className="text-muted">1</td><td>TI Investigation In Progress</td><td className="mono">0</td><td className="mono">0</td><td className="mono">0</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderZendeskPage = () => (
    <div className="kpi-page-content">
      <div className="grid-2 mb-16">
        <div>
          <div className="fs-10 uppercase fw-600 text-muted mb-12" style={{ letterSpacing: '0.08em' }}>TAX</div>
          <div className="kpi-grid kpi-grid-2 mb-12">
            <div className="kpi-card"><div className="kpi-card-label">TAX Total Tickets</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">TAX Tickets Pending</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">TAX Urgent Tickets Pending</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val gold lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">TAX Tickets Solved</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val green lg">0</div></div>
          </div>
        </div>
        <div>
          <div className="fs-10 uppercase fw-600 text-muted mb-12" style={{ letterSpacing: '0.08em' }}>DEBT</div>
          <div className="kpi-grid kpi-grid-2 mb-12">
            <div className="kpi-card"><div className="kpi-card-label">DEBT Total Tickets</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">DEBT Open Tickets</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">DEBT Unassigned Tickets</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val red lg">0</div></div>
            <div className="kpi-card"><div className="kpi-card-label">DEBT Solved Tickets</div><div className="kpi-card-sub">Today</div><div className="kpi-card-val green lg">0</div></div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="app">
      <style>{`
        body,html{height:100%}.app,.sidebar,body{overflow:hidden}.nav-item,.topbar-btn{transition:.12s;cursor:pointer}.progress-label,.user-name{text-overflow:ellipsis;white-space:nowrap}.bar-x-label,.data-table th,.progress-label,.ticker-item,.topbar-btn,.user-name{white-space:nowrap}:root{--bg0:#080b12;--bg1:#0d1017;--bg2:#111520;--bg3:#161b28;--bg4:#1c2235;--bg5:#232a3e;--border:#1e2538;--border2:#2a3348;--border3:#364058;--text:#e8eaf2;--text2:#9ba3bc;--text3:#5c657e;--text4:#363d52;--gold:#e8a020;--gold2:#f5bc50;--gold3:#ffd880;--gold-dim:rgba(232,160,32,0.12);--gold-dim2:rgba(232,160,32,0.06);--red:#e03b3b;--red2:#ff6b6b;--red-dim:rgba(224,59,59,0.12);--green:#2ecc8e;--green2:#4eeaaa;--green-dim:rgba(46,204,142,0.10);--blue:#4d8ef0;--blue-dim:rgba(77,142,240,0.12);--orange:#f07020;--orange-dim:rgba(240,112,32,0.12);--purple:#9b6cf0;--purple-dim:rgba(155,108,240,0.12);--font:'DM Sans',sans-serif;--mono:'JetBrains Mono',monospace;--display:'Syne',sans-serif;--sidebar-w:220px;--topbar-h:48px;--radius:8px;--radius2:12px}*,::after,::before{box-sizing:border-box;margin:0;padding:0}body{font-family:var(--font);background:var(--bg0);color:var(--text);font-size:13px;-webkit-font-smoothing:antialiased}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:0 0}::-webkit-scrollbar-thumb{background:var(--border3);border-radius:2px}.app{display:flex;height:100vh}.sidebar{width:var(--sidebar-w);flex-shrink:0;background:var(--bg1);border-right:1px solid var(--border);display:flex;flex-direction:column}.sidebar-logo{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}.sidebar-logo-mark{width:32px;height:32px;border-radius:7px;background:linear-gradient(135deg,var(--gold) 0,#b07010 100%);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:14px;font-weight:800;color:#000;flex-shrink:0}.sidebar-logo-text{font-family:var(--display);font-size:13px;font-weight:700;color:var(--text);letter-spacing:-.02em;line-height:1.2}.sidebar-logo-sub{font-size:9px;color:var(--text3);letter-spacing:.08em;text-transform:uppercase}.sidebar-nav{flex:1;overflow-y:auto;padding:8px 0}.nav-item,.sidebar-bottom{align-items:center;display:flex}.nav-section{margin-bottom:4px}.nav-section-label{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text4);padding:10px 16px 4px}.live-pill,.stat-card-label,.topbar-stat-label{letter-spacing:.06em;text-transform:uppercase}.nav-item{gap:9px;padding:7px 16px;color:var(--text3);font-size:12px;font-weight:500;border-radius:0;position:relative;user-select:none;border-left:2px solid transparent}.nav-item:hover{background:var(--bg3);color:var(--text2)}.nav-item.active{background:var(--gold-dim2);color:var(--gold);border-left-color:var(--gold)}.nav-item svg{flex-shrink:0;opacity:.7}.nav-item.active svg{opacity:1}.nav-badge{margin-left:auto;font-family:var(--mono);font-size:9px;font-weight:600;background:var(--red-dim);color:var(--red);padding:1px 5px;border-radius:10px;border:1px solid rgba(224,59,59,.2)}.decision-badge.WATCH,.nav-badge.gold{background:var(--gold-dim);color:var(--gold);border-color:rgba(232,160,32,.2)}.sidebar-bottom{border-top:1px solid var(--border);padding:10px 16px;gap:8px}.user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--gold),#b07010);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0}.user-info{flex:1;min-width:0}.user-name{font-size:12px;font-weight:600;color:var(--text);overflow:hidden}.date-range-sep,.gauge-label,.user-role{font-size:10px;color:var(--text3)}.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}.topbar{height:var(--topbar-h);flex-shrink:0;background:var(--bg1);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0;padding:0 16px}.topbar-title{font-family:var(--display);font-size:15px;font-weight:700;color:var(--text);flex:1}.live-pill,.topbar-stats{align-items:center;display:flex}.topbar-meta{font-size:11px;color:var(--text3);margin-left:8px}.topbar-stats{gap:2px;margin-left:16px}.topbar-stat{padding:4px 12px;border-radius:var(--radius);text-align:center;min-width:64px}.topbar-stat-val{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--text)}.kpi-card-val.gold,.stat-val.gold,.text-gold,.topbar-stat-val.gold{color:var(--gold)}.kpi-card-val.green,.stat-val.green,.text-green,.topbar-stat-val.green{color:var(--green)}.kpi-card-val.red,.stat-val.red,.text-red,.topbar-stat-val.red{color:var(--red)}.topbar-stat-label{font-size:9px;color:var(--text3)}.topbar-divider{width:1px;height:24px;background:var(--border);margin:0 8px}.live-pill{gap:5px;background:var(--green-dim);border:1px solid rgba(46,204,142,.2);border-radius:20px;padding:3px 10px;font-size:10px;font-weight:600;color:var(--green)}.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);animation:2s infinite pulse}.date-range input,.topbar-btn{background:var(--bg3);font-size:11px;color:var(--text2)}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}.date-range{display:flex;align-items:center;gap:6px;margin-left:12px}.date-range input{border:1px solid var(--border2);border-radius:var(--radius);font-family:var(--mono);padding:4px 8px}.filter-select,.topbar-btn{border-radius:var(--radius)}.date-range input:focus,.filter-select:focus{outline:0;border-color:var(--gold);color:var(--text)}.topbar-btn{padding:5px 12px;border:1px solid var(--border2);font-family:var(--font);margin-left:6px}.filter-row,.section-hdr,.stat-card,.ticker-bar{background:var(--bg2)}.data-table .mono,.stat-val,.ticker-score{font-family:var(--mono)}.topbar-btn:hover{background:var(--bg4);color:var(--text)}.topbar-btn.primary{background:var(--gold);color:#000;border-color:var(--gold);font-weight:600}.topbar-btn.primary:hover,.wave-seg.marker-gold{background:var(--gold2)}.data-table tr:hover td,.filter-select,.ticker-item:hover{background:var(--bg3)}.ticker-bar{height:32px;flex-shrink:0;border-bottom:1px solid var(--border);display:flex;align-items:center;overflow-x:auto;scrollbar-width:none}.ticker-bar::-webkit-scrollbar{display:none}.ticker-item{display:flex;align-items:center;gap:5px;padding:0 10px;border-right:1px solid var(--border);height:100%;cursor:pointer;transition:background .1s;flex-shrink:0}.ticker-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}.ticker-name{font-size:10px;color:var(--text2)}.ticker-score{font-size:10px;font-weight:600}.ticker-delta{font-size:9px}.stat-card-label,.stat-card-sub{font-size:10px;color:var(--text3)}.academy-main,.content,.lb-main,.sdr-main{flex:1;overflow-y:auto}.modal-tab-content,.page{display:none}.modal-tab-content.active,.page.active{display:block}.stat-card{border:1px solid var(--border);border-radius:var(--radius2);padding:16px;transition:border-color .15s}.pip-card:hover,.report-card:hover,.sdr-card:hover,.stage-pillar:hover,.stat-card:hover{border-color:var(--border2)}.data-table td,.data-table th,.filter-row,.section-hdr{border-bottom:1px solid var(--border)}.stat-card-label{margin-bottom:6px}.stat-card-sub{margin-top:2px}.stat-val{font-size:26px;font-weight:600;color:var(--text);line-height:1}.stat-val.blue{color:var(--blue)}.stat-val.lg{font-size:32px}.stat-val.sm{font-size:18px}.section-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:20}.section-hdr-title{font-family:var(--display);font-size:13px;font-weight:700;color:var(--text)}.section-hdr-actions{display:flex;gap:6px;align-items:center}.grid-2,.grid-3,.grid-4,.grid-5,.grid-6{display:grid}.gap-12,.grid-2,.grid-3,.grid-4,.grid-5,.grid-6{gap:12px}.grid-2{grid-template-columns:1fr 1fr}.grid-3{grid-template-columns:repeat(3,1fr)}.grid-4{grid-template-columns:repeat(4,1fr)}.grid-5{grid-template-columns:repeat(5,1fr)}.grid-6{grid-template-columns:repeat(6,1fr)}.p-12{padding:12px}.p-16{padding:16px}.mb-12{margin-bottom:12px}.mb-16{margin-bottom:16px}.data-table{width:100%;border-collapse:collapse}.data-table th{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);padding:7px 12px;text-align:left}.data-table td{padding:8px 12px;font-size:12px;color:var(--text2)}.data-table .mono{font-size:11px}.data-table .score-great{color:var(--green);font-weight:600}.data-table .score-ok{color:var(--gold);font-weight:600}.data-table .score-bad{color:var(--red);font-weight:600}.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}.filter-btn,.filter-select{color:var(--text2);font-size:11px;font-family:var(--font);cursor:pointer}.badge.green,.scale-kill-badge.SCALE{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,142,.2)}.badge.red,.scale-kill-badge.KILL{background:var(--red-dim);color:var(--red);border:1px solid rgba(224,59,59,.2)}.badge.gold,.scale-kill-badge.WATCH{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(232,160,32,.2)}.badge.blue{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(77,142,240,.2)}.badge.orange{background:var(--orange-dim);color:var(--orange);border:1px solid rgba(240,112,32,.2)}.badge.purple{background:var(--purple-dim);color:var(--purple);border:1px solid rgba(155,108,240,.2)}.academy-tag.untagged,.badge.grey,.promo-badge.NOT_YET{background:var(--bg4);color:var(--text3);border:1px solid var(--border2)}.filter-row{display:flex;align-items:center;gap:6px;padding:8px 12px;flex-wrap:wrap;position:sticky;top:0px;z-index: 10;}.filter-select{padding:4px 20px 4px 8px;border:1px solid var(--border2);appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%235c657e'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center}.filter-btn{padding:4px 10px;border-radius:var(--radius);border:1px solid var(--border2);background:var(--bg3);transition:.12s}.donut-center-val,.filter-count,.gauge-val,.progress-val{font-family:var(--mono)}.academy-tab.active.all,.filter-btn.active,.filter-btn:hover{background:var(--bg5);color:var(--text);border-color:var(--border3)}.call-row-expanded,.panel-hdr{border-bottom:1px solid var(--border)}.filter-count{margin-left:auto;font-size:10px;color:var(--text3)}.gauge-wrap{text-align:center;position:relative}.gauge-val{font-weight:700;color:var(--text)}.mini-bar-wrap{flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}.mini-bar{height:100%;border-radius:2px}.progress-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}.progress-label{font-size:11px;color:var(--text2);min-width:120px;overflow:hidden}.progress-val{font-size:10px;min-width:36px;text-align:right}.donut-wrap,.readiness-ring{position:relative;display:inline-flex;align-items:center;justify-content:center}.donut-center,.readiness-val{position:absolute;text-align:center}.donut-center-val{font-size:20px;font-weight:700;color:var(--text);line-height:1}.donut-center-label{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em}.panel{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);overflow:hidden}.panel-hdr{padding:10px 14px;display:flex;align-items:center;justify-content:space-between}.panel-title{font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.06em}.kpi-page-content,.panel-body{padding:14px}.call-table-wrap{overflow-x:auto}.call-row-expanded{background:var(--bg3);padding:14px 14px 14px 48px}.checkpoint-grid{display:flex;flex-wrap:wrap;gap:6px}.checkpoint-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:var(--radius);font-size:10px;border:1px solid var(--border)}.checkpoint-pill.pass{background:var(--green-dim);border-color:rgba(46,204,142,.2);color:var(--green)}.checkpoint-pill.fail{background:var(--red-dim);border-color:rgba(224,59,59,.2);color:var(--red)}.checkpoint-pill.na,.tracker-item.na{background:var(--bg4);color:var(--text3)}.academy-layout,.lb-layout,.sdr-layout,.split-layout{display:flex;height:100%;overflow:hidden}.split-main{flex:1;overflow-y:auto;min-width:0}.split-sidebar{width:240px;flex-shrink:0;border-left:1px solid var(--border);background:var(--bg2);overflow-y:auto}.split-sidebar-section{border-bottom:1px solid var(--border);padding:12px}.split-sidebar-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:10px}.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px)}.ai-insight,.flex,.modal,.modal-actions,.modal-hdr,.modal-overlay.open,.modal-tabs,.tracker-group-hdr,.tracker-item{display:flex}.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius2);width:640px;max-width:95vw;max-height:90vh;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.6);animation:.2s modalIn}.modal-close,.modal-tab{background:0 0;cursor:pointer}@keyframes modalIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.modal-hdr{padding:16px 20px;border-bottom:1px solid var(--border);align-items:flex-start;justify-content:space-between}.modal-close{border:none;color:var(--text3);font-size:18px;line-height:1;padding:2px}.ai-insight-text strong,.modal-agent-name,.modal-close:hover{color:var(--text)}.modal-agent-name{font-family:var(--display);font-size:16px;font-weight:700}.modal-meta{font-size:11px;color:var(--text3);margin-top:3px}.modal-score-badge{font-family:var(--mono);font-size:28px;font-weight:700;width:64px;height:64px;border-radius:var(--radius2);display:flex;align-items:center;justify-content:center;flex-shrink:0}.modal-score-badge.great{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,142,.3)}.modal-score-badge.ok{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(232,160,32,.3)}.modal-score-badge.bad{background:var(--red-dim);color:var(--red);border:1px solid rgba(224,59,59,.3)}.modal-tabs{border-bottom:1px solid var(--border)}.modal-tab{padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);border-bottom:2px solid transparent;border-top:none;border-left:none;border-right:none;transition:.12s}.ai-insight-text,.modal-tab:hover{color:var(--text2)}.modal-tab.active{color:var(--gold);border-bottom-color:var(--gold)}.modal-body{flex:1;overflow-y:auto;padding:20px}.ai-insight{gap:12px;margin-bottom:16px;align-items:flex-start}.ai-insight-icon{font-size:20px;flex-shrink:0;margin-top:1px}.bar-x-label,.wpm-x{margin-top:3px;font-size:8px}.ai-insight-text{font-size:13px;line-height:1.6}.tracker-group{border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;overflow:hidden}.tracker-group-hdr{align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;background:var(--bg3);font-size:12px;font-weight:600;color:var(--text)}.tracker-group-hdr:hover{background:var(--bg4)}.tracker-group-count{font-size:10px;color:var(--text3);font-weight:400}.tracker-group-body{padding:8px}.tracker-item{align-items:center;gap:8px;padding:7px 10px;border-radius:var(--radius);margin-bottom:4px;font-size:11px}.tracker-item.good,.tracker-item.pass{background:var(--green-dim);color:var(--green)}.tracker-item.bad,.tracker-item.fail{background:var(--red-dim);color:var(--red)}.tracker-icon{font-size:12px;flex-shrink:0}.modal-actions{gap:8px;padding:12px 20px;border-top:1px solid var(--border)}.modal-btn{padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid transparent;display:inline-flex;align-items:center;gap:6px}.modal-btn.primary{background:var(--gold);color:#000;border-color:var(--gold)}.modal-btn.outline{background:var(--bg3);color:var(--gold);border-color:var(--gold)}.lb-sidebar{width:260px;flex-shrink:0;border-left:1px solid var(--border);background:var(--bg2);overflow-y:auto}.lb-toggle{display:flex;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border2);overflow:hidden}.lb-toggle-btn{padding:4px 14px;font-size:11px;font-family:var(--font);border:none;background:0 0;color:var(--text2);cursor:pointer;transition:.12s}.bar-x-label,.bar-y-val,.dim-val,.font-mono,.kpi-card-val,.lead-score-badge,.marker-pill,.readiness-num,.stage-num,.wpm-x{font-family:var(--mono)}.lb-toggle-btn.active{background:var(--bg5);color:var(--gold)}.analytics-content{padding:14px;display:flex;flex-direction:column;gap:14px}.bar-chart{display:flex;align-items:flex-end;gap:3px;height:80px}.bar-col,.wpm-bar-col{display:flex;flex-direction:column;align-items:center;flex:1}.bar-seg{width:100%;border-radius:2px 2px 0 0;transition:opacity .15s}.pip-card,.report-card{transition:border-color .15s}.bar-seg:hover{opacity:.8}.bar-x-label{color:var(--text3)}.bar-y-val{font-size:8px;color:var(--text2);margin-bottom:2px}.qb-bar-wrap{display:flex;align-items:center;gap:6px;width:160px}.qb-bar{height:6px;border-radius:3px}.wpm-chart{display:flex;align-items:flex-end;gap:4px;height:100px}.lead-score-badge,.scale-kill-badge{display:inline-flex;align-items:center;font-weight:700}.wpm-bar{width:100%;border-radius:2px 2px 0 0}.wpm-x{color:var(--text3)}.lead-score-badge{justify-content:center;width:44px;height:24px;border-radius:var(--radius);font-size:11px}.academy-tag.exemplar,.flag-scale,.promo-badge.READY{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,142,.25)}.academy-tag.featured,.flag-watch,.promo-badge.WATCH{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(232,160,32,.25)}.academy-tag.warning,.flag-kill{background:var(--red-dim);color:var(--red);border:1px solid rgba(224,59,59,.25)}.scale-kill-badge{gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.kpi-card,.pip-card{border:1px solid var(--border)}.academy-tag,.readiness-label{letter-spacing:.05em;text-transform:uppercase}.pip-card{background:var(--bg2);border-radius:var(--radius2);padding:16px;margin-bottom:10px}.alert-toast.warning,.call-card-academy.featured,.pip-card.level-warn,.report-type-friday,.sdr-card.watch{border-left:3px solid var(--gold)}.pip-card.level-pip{border-left:3px solid var(--orange)}.alert-toast.critical,.call-card-academy.worst,.pip-card.level-final{border-left:3px solid var(--red)}.pip-card.level-exec{border-left:3px solid var(--purple)}.pip-progress{display:flex;align-items:center;gap:8px;margin-top:10px}.pip-days-track{flex:1;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden}.pip-days-fill{height:100%;border-radius:3px}.strike-card{background:var(--red-dim);border:1px solid rgba(224,59,59,.25);border-radius:var(--radius2);padding:14px;margin-bottom:10px}.decision-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid transparent}.decision-badge.ON_TRACK{background:var(--green-dim);color:var(--green);border-color:rgba(46,204,142,.2)}.decision-badge.REVIEW{background:var(--orange-dim);color:var(--orange);border-color:rgba(240,112,32,.2)}.decision-badge.SEPARATE{background:var(--red-dim);color:var(--red);border-color:rgba(224,59,59,.2)}.decision-badge.IMMEDIATE{background:var(--red-dim);color:var(--red);border-color:rgba(224,59,59,.3);animation:1.5s infinite urgentPulse}@keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.6}}.kpi-grid{display:grid;gap:12px}.kpi-grid-5{grid-template-columns:repeat(5,1fr)}.kpi-grid-4{grid-template-columns:repeat(4,1fr)}.kpi-grid-3{grid-template-columns:repeat(3,1fr)}.kpi-grid-2{grid-template-columns:repeat(2,1fr)}.kpi-card{background:var(--bg2);border-radius:var(--radius2);padding:14px;position:relative;overflow:hidden}.kpi-card-label{font-size:10px;color:var(--text3);margin-bottom:4px}.kpi-card-sub{font-size:9px;color:var(--text4);margin-bottom:6px}.kpi-card-val{font-size:22px;font-weight:700;color:var(--text);line-height:1}.fw-600,.toast-title{font-weight:600}.kpi-card-val.lg{font-size:30px}.gauge-ring{transform:rotate(-90deg);transform-origin:center}.report-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:16px;margin-bottom:10px;cursor:pointer}.report-type-nightly{border-left:3px solid var(--blue)}.alert-toast-container{position:fixed;top:60px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px}.alert-toast{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius2);padding:12px 16px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:.25s toastIn;display:flex;gap:10px;align-items:flex-start}@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}.toast-icon{font-size:16px;flex-shrink:0;margin-top:1px}.toast-title{font-size:12px;color:var(--text)}.toast-msg{font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4}.academy-tab,.readiness-label,.text-muted,.toast-dismiss{color:var(--text3)}.toast-dismiss{background:0 0;border:none;cursor:pointer;margin-left:auto;flex-shrink:0;font-size:14px}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-between{justify-content:space-between}.gap-6{gap:6px}.gap-8{gap:8px}.gap-10{gap:10px}.academy-tab,.academy-tag,.fw-700,.promo-badge,.readiness-num,.stage-num{font-weight:700}.fs-10{font-size:10px}.fs-11{font-size:11px}.fs-12{font-size:12px}.academy-sidebar{width:280px;flex-shrink:0;border-left:1px solid var(--border);background:var(--bg2);overflow-y:auto}.call-card-academy{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius2);padding:14px 16px;margin-bottom:8px;cursor:pointer;transition:.12s;position:relative;overflow:hidden}.academy-tag,.marker-pill{align-items:center;padding:3px 9px;font-size:10px}.call-card-academy:hover,.tag-option:hover{border-color:var(--border2);background:var(--bg3)}.call-card-academy.best,.sdr-card.ready{border-left:3px solid var(--green)}.academy-tag{display:inline-flex;gap:4px;border-radius:20px}.marker-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.marker-pill{display:inline-flex;gap:5px;border-radius:4px;border:1px solid var(--border2);background:var(--bg3);cursor:pointer;transition:.1s}.marker-pill:hover{border-color:var(--gold);color:var(--gold)}.academy-tab.active.exemplar,.marker-pill.green{background:var(--green-dim);color:var(--green);border-color:rgba(46,204,142,.3)}.marker-pill.red{border-color:rgba(224,59,59,.3);color:var(--red);background:var(--red-dim)}.marker-pill.gold{border-color:rgba(232,160,32,.3);color:var(--gold);background:var(--gold-dim)}.waveform-bar{display:flex;align-items:center;gap:2px;height:32px;cursor:pointer}.wave-seg{width:3px;border-radius:1.5px;background:var(--border3);transition:background .1s;flex-shrink:0}.wave-seg.played{background:var(--gold)}.wave-seg.marker-green{background:var(--green)}.wave-seg.marker-red{background:var(--red)}.academy-filter-tabs{display:flex;gap:4px}.academy-tab{padding:5px 14px;border-radius:var(--radius);font-size:11px;cursor:pointer;border:1px solid var(--border2);background:var(--bg3);transition:.12s}.sdr-card,.sdr-sidebar,.tag-modal{background:var(--bg2)}.academy-tab.active.warning{background:var(--red-dim);color:var(--red);border-color:rgba(224,59,59,.3)}.academy-tab.active.featured{background:var(--gold-dim);color:var(--gold);border-color:rgba(232,160,32,.3)}.tag-modal{border:1px solid var(--border2);border-radius:var(--radius2);padding:20px;width:480px;max-width:95vw;box-shadow:0 24px 80px rgba(0,0,0,.6);animation:.2s modalIn}.tag-option{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius);margin-bottom:6px;cursor:pointer;border:1px solid var(--border);transition:.1s}.stage-pillar.active,.tag-option.selected{border-color:var(--gold);background:var(--gold-dim2)}.sdr-sidebar{width:300px;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto}.sdr-card{border:1px solid var(--border);border-radius:var(--radius2);padding:16px;margin-bottom:10px;transition:border-color .15s;position:relative}.sdr-card.not-yet{border-left:3px solid var(--border3)}.sdr-card.promoted{border-left:3px solid var(--purple);opacity:.7}.readiness-num{font-size:18px;line-height:1}.readiness-label{font-size:8px}.dim-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}.dim-name{font-size:10px;color:var(--text2);min-width:120px}.dim-bar-track{flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden}.dim-bar-fill{height:100%;border-radius:3px;transition:width .4s}.dim-val{font-size:10px;min-width:30px;text-align:right}.stage-pillar{display:flex;flex-direction:column;align-items:center;flex:1;padding:10px 6px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg3);cursor:pointer;transition:.12s}.stage-num{font-size:20px}.stage-label{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);text-align:center;margin-top:3px}.promo-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:11px}.promo-badge.PROMOTED{background:var(--purple-dim);color:var(--purple);border:1px solid rgba(155,108,240,.25)}
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ padding: '12px 14px', gap: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'linear-gradient(135deg,#e8a020 0%,#f5bc50 60%,#fff3c0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 2L18 16H2L10 2Z" fill="#000" opacity="0.85" /><circle cx="10" cy="13" r="2.5" fill="#e8a020" /></svg>
            </div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '15px', fontWeight: 900, letterSpacing: '0.04em', color: '#e8eaf2', lineHeight: '1' }}>analytiq</div>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, paddingLeft: '34px' }}>City Financial</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">QA Platform</div>
            <div className={`nav-item ${activePage === 'qa-live' ? 'active' : ''}`} onClick={() => setActivePage('qa-live')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Live Feed
              <span className="nav-badge">3</span>
            </div>
            <div className={`nav-item ${activePage === 'leaderboard' ? 'active' : ''}`} onClick={() => setActivePage('leaderboard')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Leaderboard
            </div>
            <div className={`nav-item ${activePage === 'analytics' ? 'active' : ''}`} onClick={() => setActivePage('analytics')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              Analytics
            </div>
            <div className={`nav-item ${activePage === 'pips' ? 'active' : ''}`} onClick={() => setActivePage('pips')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              PIPs
              <span className="nav-badge">2</span>
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Growth</div>
            <div className={`nav-item ${activePage === 'academy' ? 'active' : ''}`} onClick={() => setActivePage('academy')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
              CF Academy
              <span className="nav-badge gold" style={{ fontSize: '9px' }}>NEW</span>
            </div>
            <div className={`nav-item ${activePage === 'sdr-pipeline' ? 'active' : ''}`} onClick={() => setActivePage('sdr-pipeline')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="21" x2="23" y2="19" /><line x1="19" y1="21" x2="19" y2="17" /><path d="M21 3l-3 3 3 3" /><path d="M21 6h-6" /></svg>
              SDR → Closer
              <span className="nav-badge gold" id="sdr-ready-badge">{sdrAgents.filter(a => a.status === 'READY').length}</span>
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Intelligence</div>
            <div className={`nav-item ${activePage === 'lead-attribution' ? 'active' : ''}`} onClick={() => setActivePage('lead-attribution')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 012 2v7" /><line x1="6" y1="9" x2="6" y2="21" /></svg>
              Lead Attribution
            </div>
            <div className={`nav-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => setActivePage('reports')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Reports
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">KPI Boards</div>
            <div className={`nav-item ${activePage === 'accounting' ? 'active' : ''}`} onClick={() => setActivePage('accounting')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              Accounting
            </div>
            <div className={`nav-item ${activePage === 'debt-board' ? 'active' : ''}`} onClick={() => setActivePage('debt-board')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              Debt Board
            </div>
            <div className={`nav-item ${activePage === 'finance-board' ? 'active' : ''}`} onClick={() => setActivePage('finance-board')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              Finance Board
            </div>
            <div className={`nav-item ${activePage === 'bbb' ? 'active' : ''}`} onClick={() => setActivePage('bbb')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              BBB Dashboard
            </div>
            <div className={`nav-item ${activePage === 'marketing' ? 'active' : ''}`} onClick={() => setActivePage('marketing')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Marketing KPIs
            </div>
            <div className={`nav-item ${activePage === 'tax-debt-backend' ? 'active' : ''}`} onClick={() => setActivePage('tax-debt-backend')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              Tax & Debt Backend
            </div>
            <div className={`nav-item ${activePage === 'tax-prep' ? 'active' : ''}`} onClick={() => setActivePage('tax-prep')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
              Tax Prep Tracking
            </div>
            <div className={`nav-item ${activePage === 'zendesk' ? 'active' : ''}`} onClick={() => setActivePage('zendesk')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              Zendesk Tickets
            </div>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">NK</div>
          <div className="user-info">
            <div className="user-name">Nick Kahlschreiber</div>
            <div className="user-role">Executive</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{PAGE_TITLES[activePage]?.[0] || activePage}</div>
          <div className="topbar-meta">{PAGE_TITLES[activePage]?.[1] || 'City Financial'}</div>
          <div className="topbar-stats">
            <div className="topbar-stat"><div className="topbar-stat-val">1,023</div><div className="topbar-stat-label">Calls</div></div>
            <div className="topbar-stat"><div className="topbar-stat-val gold">54.1</div><div className="topbar-stat-label">Avg QA</div></div>
            <div className="topbar-stat"><div className="topbar-stat-val green">22</div><div className="topbar-stat-label">Enrolled</div></div>
          </div>
          <div className="topbar-divider"></div>
          <div className="date-range">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="date-range-sep">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button className="topbar-btn" onClick={handleDateRangeApply}>Apply</button>
          <div className="topbar-divider"></div>
          <div className="live-pill"><div className="live-dot"></div> Live</div>
        </div>

        <div className="ticker-bar">{renderTicker()}</div>

        <div className="content">
          {/* QA Live Page */}
          <div className={`page ${activePage === 'qa-live' ? 'active' : ''}`}>
            <div className="split-layout" style={{ height: 'calc(100vh - var(--topbar-h) - 32px - 1px)' }}>
              <div className="split-main">
                <div className="filter-row">
                  <select className="filter-select" value={filters.outcome} onChange={(e) => handleFilterChange('outcome', e.target.value)}>
                    <option value="">All Outcomes</option>
                    {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select className="filter-select" value={filters.flag} onChange={(e) => handleFilterChange('flag', e.target.value)}>
                    <option value="">All Flags</option>
                    {FLAGS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select className="filter-select" value={filters.score} onChange={(e) => handleFilterChange('score', e.target.value)}>
                    <option value="">All Scores</option>
                    <option value="red">Red (0–49)</option>
                    <option value="yellow">Yellow (50–79)</option>
                    <option value="green">Great (80–100)</option>
                  </select>
                  <select className="filter-select" value={filters.dept} onChange={(e) => handleFilterChange('dept', e.target.value)}>
                    <option value="">All Depts</option>
                    <option value="Debt Sales">Debt Sales</option>
                    <option value="Verification">Verification</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Case Managers">Case Managers</option>
                    <option value="City Financial">City Financial</option>
                  </select>
                  <span className="filter-count">{callFilterCount.toLocaleString()} calls</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '260px 70px 90px 100px 130px 1fr', padding: '6px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: '38px', zIndex: 10 }}>
                  <div className="fs-10 uppercase text-muted">Agent / Date</div>
                  <div className="fs-10 uppercase text-muted" style={{ textAlign: 'right' }}>Score</div>
                  <div className="fs-10 uppercase text-muted">Duration</div>
                  <div className="fs-10 uppercase text-muted">Outcome</div>
                  <div className="fs-10 uppercase text-muted">Dept</div>
                  <div className="fs-10 uppercase text-muted">Campaign / Flags</div>
                </div>
                <div id="call-rows">{renderCallRows()}</div>
              </div>

              <div className="split-sidebar">
                <div className="split-sidebar-section">
                  <div className="split-sidebar-title">Deviations</div>
                  <div className="progress-row"><div className="progress-label" style={{ fontSize: '10px' }}>Early Decline</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: '71%', background: 'var(--red)' }}></div></div><div className="progress-val text-red">71</div></div>
                  <div className="progress-row"><div className="progress-label" style={{ fontSize: '10px' }}>Early Debt Pitch</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: '40%', background: 'var(--gold)' }}></div></div><div className="progress-val text-gold">40</div></div>
                  <div className="progress-row"><div className="progress-label" style={{ fontSize: '10px' }}>Skipped Qualifying</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: '18%', background: 'var(--gold)' }}></div></div><div className="progress-val text-gold">18</div></div>
                  <div className="progress-row"><div className="progress-label" style={{ fontSize: '10px' }}>Skipped Credit Pull</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: '9%', background: 'var(--text3)' }}></div></div><div className="progress-val text-muted">9</div></div>
                  <div className="progress-row"><div className="progress-label" style={{ fontSize: '10px' }}>Rushed Call</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: '8%', background: 'var(--text3)' }}></div></div><div className="progress-val text-muted">8</div></div>
                </div>

                <div className="split-sidebar-section">
                  <div className="split-sidebar-title">Outcomes Today</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                    <div style={{ textAlign: 'center' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '18px' }}>22</div><div className="fs-10 text-muted uppercase">Enrolled</div></div>
                    <div style={{ textAlign: 'center' }}><div className="font-mono fw-700 text-gold" style={{ fontSize: '18px' }}>26</div><div className="fs-10 text-muted uppercase">Pitch</div></div>
                    <div style={{ textAlign: 'center' }}><div className="font-mono fw-700" style={{ fontSize: '18px', color: 'var(--blue)' }}>106</div><div className="fs-10 text-muted uppercase">Callback</div></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ textAlign: 'center' }}><div className="font-mono fw-700 text-red" style={{ fontSize: '18px' }}>67</div><div className="fs-10 text-muted uppercase">Declined</div></div>
                    <div style={{ textAlign: 'center' }}><div className="font-mono fw-700" style={{ fontSize: '18px', color: 'var(--orange)' }}>197</div><div className="fs-10 text-muted uppercase">Hotique</div></div>
                  </div>
                </div>

                <div className="split-sidebar-section">
                  <div className="split-sidebar-title">Agent Leaderboard</div>
                  <div id="sidebar-lb">{renderSidebarLB()}</div>
                </div>

                <div className="split-sidebar-section">
                  <div className="split-sidebar-title">🚨 Active Alerts</div>
                  <div id="sidebar-alerts">{renderSidebarAlerts()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard Page */}
          <div className={`page ${activePage === 'leaderboard' ? 'active' : ''}`}>
            <div className="lb-layout" style={{ height: 'calc(100vh - var(--topbar-h) - 32px)' }}>
              <div className="lb-main">
                <div className="section-hdr">
                  <span className="section-hdr-title">Agent Leaderboard</span>
                  <div className="section-hdr-actions">
                    <div className="lb-toggle">
                      <button className={`lb-toggle-btn ${leaderboardMode === 'agent' ? 'active' : ''}`} onClick={() => setLeaderboardMode('agent')}>By Agent</button>
                      <button className={`lb-toggle-btn ${leaderboardMode === 'campaign' ? 'active' : ''}`} onClick={() => setLeaderboardMode('campaign')}>By Campaign</button>
                    </div>
                    <select className="filter-select">
                      <option>All Depts</option>
                      <option>Debt Sales</option>
                      <option>Verification</option>
                      <option>Customer Service</option>
                      <option>Case Managers</option>
                    </select>
                    <div className="lb-toggle">
                      <button className={`lb-toggle-btn ${leaderboardTime === '1d' ? 'active' : ''}`} onClick={() => setLeaderboardTime('1d')}>1D</button>
                      <button className={`lb-toggle-btn ${leaderboardTime === '2w' ? 'active' : ''}`} onClick={() => setLeaderboardTime('2w')}>2W</button>
                      <button className={`lb-toggle-btn ${leaderboardTime === '1m' ? 'active' : ''}`} onClick={() => setLeaderboardTime('1m')}>1M</button>
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: '900px' }}>
                    <thead>
                      <tr><th>#</th><th>Agent</th><th>Dept</th><th>Avg Score</th><th>Avg Length</th><th>Calls</th><th>Enrollments</th><th>Close Rate</th><th>% Calls</th><th>Efficiency</th><th>Flagged</th><th>Flag Rate</th><th>Decision</th></tr>
                    </thead>
                    <tbody>{renderLeaderboardRows()}</tbody>
                  </table>
                </div>
              </div>
              <div className="lb-sidebar">
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title">Team Efficiency</div>
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="font-mono fw-700" style={{ fontSize: '36px', color: 'var(--text)' }}>1,023</div>
                    <div className="fs-10 text-muted uppercase">Total Calls</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div className="panel" style={{ padding: '8px', textAlign: 'center' }}><div className="font-mono text-green fw-600" style={{ fontSize: '16px' }}>22</div><div className="fs-10 text-muted">Enrollments</div></div>
                    <div className="panel" style={{ padding: '8px', textAlign: 'center' }}><div className="font-mono text-gold fw-600" style={{ fontSize: '16px' }}>2.2%</div><div className="fs-10 text-muted">Enroll Rate</div></div>
                    <div className="panel" style={{ padding: '8px', textAlign: 'center' }}><div className="font-mono fw-600" style={{ fontSize: '16px' }}>51.5</div><div className="fs-10 text-muted">Avg Score</div></div>
                    <div className="panel" style={{ padding: '8px', textAlign: 'center' }}><div className="font-mono fw-600" style={{ fontSize: '16px' }}>6:46</div><div className="fs-10 text-muted">Avg Length</div></div>
                  </div>
                </div>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title">🏆 Top Converters</div>
                  <div id="top-converters">{renderTopConverters()}</div>
                </div>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title" style={{ color: 'var(--red)' }}>Below Expected</div>
                  <div id="below-expected">{renderBelowExpected()}</div>
                </div>
                <div style={{ padding: '12px' }}>
                  <div className="split-sidebar-title">Insights</div>
                  <span className="badge gold" style={{ cursor: 'pointer', margin: '2px' }}>Close Rate Analysis</span>
                  <span className="badge gold" style={{ cursor: 'pointer', margin: '2px' }}>Score Trends</span>
                  <span className="badge blue" style={{ cursor: 'pointer', margin: '2px' }}>Floor-Wide Issues</span>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Page */}
          <div className={`page ${activePage === 'analytics' ? 'active' : ''}`}>
            <div className="analytics-content">
              <div className="grid-2">
                <div className="panel"><div className="panel-hdr"><span className="panel-title">Overview</span></div><div className="panel-body"><div className="grid-3" style={{ marginBottom: '12px' }}><div><div className="font-mono fw-700" style={{ fontSize: '28px', color: 'var(--text)' }}>2,273</div><div className="fs-10 text-muted uppercase">Total Calls</div></div><div><div className="font-mono fw-700 text-gold" style={{ fontSize: '28px' }}>53.6</div><div className="fs-10 text-muted uppercase">Avg Adherence</div></div><div><div className="font-mono fw-700" style={{ fontSize: '28px', color: 'var(--text)' }}>6:46</div><div className="fs-10 text-muted uppercase">Avg Length</div></div></div><div className="fs-11 text-muted">2,273 scored · 0 pending · <span className="text-green">0 errors</span></div></div></div>
                <div className="panel"><div className="panel-hdr"><span className="panel-title">Conversion Rates</span></div><div className="panel-body"><div className="grid-3" style={{ marginBottom: '14px' }}><div style={{ textAlign: 'center', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '22px' }}>3.3%</div><div className="fs-10 text-muted" style={{ marginTop: '3px' }}>Enrollment Rate</div><div className="fs-10 text-muted">74 of 2,273</div></div><div style={{ textAlign: 'center', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px' }}><div className="font-mono fw-700 text-gold" style={{ fontSize: '22px' }}>2.3%</div><div className="fs-10 text-muted" style={{ marginTop: '3px' }}>Debt Pitch Rate</div><div className="fs-10 text-muted">52 of 2,273</div></div><div style={{ textAlign: 'center', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px' }}><div className="font-mono fw-700 text-muted" style={{ fontSize: '22px' }}>0.0%</div><div className="fs-10 text-muted" style={{ marginTop: '3px' }}>Other</div><div className="fs-10 text-muted">—</div></div></div><div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}><div className="flex items-center gap-6"><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }}></div><span className="fs-11 text-muted">Enrolled <strong className="text-green">74</strong></span></div><div className="flex items-center gap-6"><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }}></div><span className="fs-11 text-muted">Debt Pitch <strong className="text-gold">82</strong></span></div><div className="flex items-center gap-6"><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)' }}></div><span className="fs-11 text-muted">Callback <strong style={{ color: 'var(--blue)' }}>622</strong></span></div><div className="flex items-center gap-6"><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }}></div><span className="fs-11 text-muted">Declined <strong className="text-red">148</strong></span></div><div className="flex items-center gap-6"><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--orange)' }}></div><span className="fs-11 text-muted">Hotique <strong style={{ color: 'var(--orange)' }}>242</strong></span></div></div></div></div>
              </div>
              <div className="panel"><div className="panel-hdr"><span className="panel-title">Daily QA Trend</span></div><div className="panel-body"><div className="bar-chart" style={{ height: '70px' }}>{['3/22', '3/23', '3/24', '3/25', '3/26', '3/27', '3/28', '3/29'].map((day, i) => (<div key={day} className="bar-col"><div className="bar-y-val">{[48, 52, 49, 55, 51, 54, 50, 53.6][i]}</div><div className="bar-seg" style={{ height: `${[48, 52, 49, 55, 51, 54, 50, 53.6][i] / 55 * 100}%`, background: 'var(--gold)', minHeight: '3px' }}></div><div className="bar-x-label">{day}</div></div>))}</div></div></div>
              <div className="grid-2"><div className="panel"><div className="panel-hdr"><span className="panel-title">Score Distribution</span></div><div className="panel-body"><div className="bar-chart" style={{ height: '90px' }}>{[[0, 9, 22], [10, 19, 105], [20, 29, 195], [30, 39, 327], [40, 49, 119], [50, 59, 401], [60, 69, 614], [70, 79, 401], [80, 89, 119], [90, 100, 8]].map(b => (<div key={b[0]} className="bar-col"><div className="bar-y-val fs-10">{b[2]}</div><div className="bar-seg" style={{ height: `${b[2] / 614 * 100}%`, background: b[0] < 50 ? 'var(--red)' : b[0] < 80 ? 'var(--gold)' : 'var(--green)' }}></div><div className="bar-x-label">{b[0]}-{b[1]}</div></div>))}</div></div></div><div className="panel"><div className="panel-hdr"><span className="panel-title">Agent Comparison</span></div><div className="panel-body">{AGENTS.slice(0, 12).map(a => (<div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentColor(AGENTS.indexOf(a)), flexShrink: 0 }}></div><div style={{ fontSize: '10px', color: 'var(--text2)', minWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${a.score}%`, background: scoreColor(a.score) }}></div></div><div className="font-mono fs-10 fw-600" style={{ color: scoreColor(a.score), minWidth: '28px' }}>{a.score}</div></div>))}</div></div></div>
            </div>
          </div>

          {/* PIPs Page */}
          <div className={`page ${activePage === 'pips' ? 'active' : ''}`}>
            <div className="section-hdr">
              <span className="section-hdr-title">Performance Improvement Plans</span>
              <div className="section-hdr-actions">
                <select className="filter-select"><option>All Depts</option></select>
                <select className="filter-select"><option>Active PIPs</option><option>Resolved</option><option>Separated</option></select>
                <button className="topbar-btn primary" onClick={showNewPIPModal}>+ New PIP</button>
              </div>
            </div>
            <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
              <div><div className="fs-10 uppercase text-muted fw-600" style={{ marginBottom: '10px', letterSpacing: '0.08em' }}>Active PIPs (14-Day Review)</div><div id="pip-cards">{renderPIPCards()}</div></div>
              <div><div className="fs-10 uppercase fw-600" style={{ marginBottom: '10px', letterSpacing: '0.08em', color: 'var(--red)' }}>Verification Zero-Tolerance (DR Team)</div><div style={{ background: 'var(--red-dim)', border: '1px solid rgba(224,59,59,0.2)', borderRadius: 'var(--radius2)', padding: '14px', marginBottom: '10px' }}><div className="flex items-center gap-8 mb-12"><span style={{ fontSize: '20px' }}>⚠️</span><div><div className="fw-600" style={{ fontSize: '13px', color: 'var(--text)' }}>Zero-Tolerance Policy Active</div><div className="fs-11 text-muted">DR Verification Team — 2 Strikes = Immediate Separation</div></div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}><div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-700" style={{ fontSize: '18px', color: 'var(--text)' }}>0</div><div className="fs-10 text-muted">Strike 1s</div></div><div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-700 text-red" style={{ fontSize: '18px' }}>0</div><div className="fs-10 text-muted">Strike 2s</div></div><div className="panel" style={{ padding: '10px', textAlign: 'center' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '18px' }}>✓</div><div className="fs-10 text-muted">Clean</div></div></div></div><div className="panel"><div className="panel-hdr"><span className="panel-title">Escalation Hierarchy</span></div><div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>1</div><div><div className="fs-12 fw-600">Agent</div><div className="fs-10 text-muted">System auto-flags instantly</div></div><div className="badge grey" style={{ marginLeft: 'auto' }}>Real-time</div></div><div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>2</div><div><div className="fs-12 fw-600">Floor Manager</div><div className="fs-10 text-muted">Daily coaching, documents everything</div></div><div className="badge gold" style={{ marginLeft: 'auto' }}>Day 1-7</div></div><div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>3</div><div><div className="fs-12 fw-600">Operations Director</div><div className="fs-10 text-muted">Midpoint review at Day 7</div></div><div className="badge orange" style={{ marginLeft: 'auto' }}>Day 7</div></div><div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>4</div><div><div className="fs-12 fw-600 text-gold">Nick — Executive Decision</div><div className="fs-10 text-muted">Friday report → Monday decision</div></div><div className="badge gold" style={{ marginLeft: 'auto' }}>Day 14</div></div></div></div></div>
            </div>
          </div>

          {/* Lead Attribution Page */}
          <div className={`page ${activePage === 'lead-attribution' ? 'active' : ''}`}>
            <div className="section-hdr">
              <span className="section-hdr-title">Lead Attribution & Sub ID Tracking</span>
              <div className="section-hdr-actions">
                <div className="lb-toggle">
                  <button className={`lb-toggle-btn ${leadViewMode === 'source' ? 'active' : ''}`} onClick={() => leadView('source')}>By Source</button>
                  <button className={`lb-toggle-btn ${leadViewMode === 'subid' ? 'active' : ''}`} onClick={() => leadView('subid')}>By Sub ID</button>
                </div>
                <select className="filter-select" onChange={(e) => filterLeads(e.target.value)}>
                  <option value="">All Flags</option>
                  <option value="SCALE">🟢 Scale</option>
                  <option value="WATCH">🟡 Watch</option>
                  <option value="KILL">🔴 Kill</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="fs-10 text-muted uppercase fw-600" style={{ letterSpacing: '0.06em' }}>Lead Score Weights:</span>
              <span className="fs-11 text-muted">Contact Rate <strong className="text-gold">25%</strong></span>
              <span className="fs-11 text-muted">Billable Rate <strong className="text-gold">25%</strong></span>
              <span className="fs-11 text-muted">Enrollment Rate <strong className="text-gold">20%</strong></span>
              <span className="fs-11 text-muted">Deal Value <strong className="text-gold">15%</strong></span>
              <span className="fs-11 text-muted">Call Duration <strong className="text-gold">10%</strong></span>
              <span className="fs-11 text-muted">QA Score <strong className="text-gold">5%</strong></span>
            </div>
            <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', borderBottom: '1px solid var(--border)' }}>
              <div className="stat-card"><div className="stat-card-label">Total Leads</div><div className="stat-val">2,847</div></div>
              <div className="stat-card"><div className="stat-card-label">Contact Rate</div><div className="stat-val gold">38.2%</div></div>
              <div className="stat-card"><div className="stat-card-label">Billable Rate</div><div className="stat-val gold">12.4%</div></div>
              <div className="stat-card"><div className="stat-card-label">Enrollment Rate</div><div className="stat-val green">2.2%</div></div>
              <div className="stat-card"><div className="stat-card-label">Avg Deal Value</div><div className="stat-val green">$3,840</div></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '900px' }}>
                <thead>
                  <tr><th>#</th><th>Source</th><th>Sub ID / Campaign</th><th>Leads</th><th>Contacts</th><th>Contact Rate</th><th>Billable Rate</th><th>Enrollments</th><th>Enroll Rate</th><th>Avg Deal</th><th>QA Avg</th><th>Lead Score</th><th>Flag</th></tr>
                </thead>
                <tbody>{renderLeadRows()}</tbody>
              </table>
            </div>
          </div>

          {/* Reports Page */}
          <div className={`page ${activePage === 'reports' ? 'active' : ''}`}>
            <div className="section-hdr">
              <span className="section-hdr-title">Reports</span>
              <div className="section-hdr-actions">
                <select className="filter-select"><option>All Reports</option><option>Nightly</option><option>Friday Executive</option></select>
                <button className="topbar-btn primary" onClick={() => generateReport('nightly')}>▶ Run Nightly Now</button>
                <button className="topbar-btn" onClick={() => generateReport('friday')}>▶ Run Friday Report</button>
              </div>
            </div>
            <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', height: 'calc(100vh - var(--topbar-h) - 32px - 48px)', overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto' }}>
                <div className="fs-10 uppercase text-muted fw-600" style={{ marginBottom: '8px', letterSpacing: '0.08em' }}>Recent Reports</div>
                <div id="report-list">{renderReportList()}</div>
              </div>
              <div className="panel" style={{ overflowY: 'auto' }}>
                <div className="panel-hdr"><span className="panel-title" id="report-viewer-title">{selectedReport ? selectedReport.title : 'Select a report'}</span></div>
                <div className="panel-body" id="report-viewer-body">
                  {selectedReport ? (
                    <div>
                      <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                        <div className="font-mono fw-700 text-gold" style={{ fontSize: '32px' }}>{selectedReport.qa}%</div>
                        <div className="fs-11 text-muted">Avg QA Score</div>
                      </div>
                      <div className="grid-3 mb-16">
                        <div style={{ textAlign: 'center' }}><div className="font-mono fw-700" style={{ fontSize: '20px' }}>{selectedReport.calls}</div><div className="fs-10 text-muted uppercase">Calls</div></div>
                        <div style={{ textAlign: 'center' }}><div className="font-mono fw-700 text-green" style={{ fontSize: '20px' }}>{selectedReport.enrolls}</div><div className="fs-10 text-muted uppercase">Enrolled</div></div>
                        <div style={{ textAlign: 'center' }}><div className="font-mono fw-700 text-red" style={{ fontSize: '20px' }}>{selectedReport.pips}</div><div className="fs-10 text-muted uppercase">Active PIPs</div></div>
                      </div>
                      <div className="fs-12 fw-600 mb-12">Executive Summary</div>
                      <div style={{ padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.7', borderLeft: '3px solid var(--gold)' }}>
                        This week the operation scored {selectedReport.qa}% avg QA across {selectedReport.calls} calls with {selectedReport.enrolls} total enrollments.
                        The Debt Sales department is performing below the 60% threshold target.
                        {selectedReport.pips} agent{selectedReport.pips !== 1 ? 's are' : ' is'} currently on 14-day PIPs.
                        Lead attribution shows Facebook as the top performing sub ID with 74 composite score — recommend scaling budget.
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                      <div className="fs-12">Select a report from the list to preview</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CF Academy Page */}
          <div className={`page ${activePage === 'academy' ? 'active' : ''}`}>
            <div className="section-hdr">
              <div><span className="section-hdr-title">CF Academy</span><span className="fs-11 text-muted" style={{ marginLeft: '10px' }}>City Financial · Call Library & Training Markers</span></div>
              <div className="section-hdr-actions">
                <div className="academy-filter-tabs">
                  <div className={`academy-tab active all ${academyFilter === 'all' ? 'active' : ''}`} onClick={() => academyFilterChange('all')}>All</div>
                  <div className={`academy-tab exemplar ${academyFilter === 'exemplar' ? 'active exemplar' : ''}`} onClick={() => academyFilterChange('exemplar')}>⭐ Exemplar</div>
                  <div className={`academy-tab featured ${academyFilter === 'featured' ? 'active featured' : ''}`} onClick={() => academyFilterChange('featured')}>🎯 Featured</div>
                  <div className={`academy-tab warning ${academyFilter === 'warning' ? 'active warning' : ''}`} onClick={() => academyFilterChange('warning')}>⚠️ Warning</div>
                </div>
                <select className="filter-select" value={academyDept} onChange={(e) => setAcademyDept(e.target.value)}>
                  <option value="">All Depts</option>
                  <option value="Debt Sales">Debt Sales</option>
                  <option value="Verification">Verification</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="City Financial">City Financial</option>
                </select>
                <select className="filter-select" value={academyMarker} onChange={(e) => setAcademyMarker(e.target.value)}>
                  <option value="">All Markers</option>
                  {MARKER_TYPES.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
                </select>
                <button className="topbar-btn primary" onClick={showAutoTagModal}>⚡ Auto-Tag Calls</button>
              </div>
            </div>
            <div className="academy-layout" style={{ height: 'calc(100vh - var(--topbar-h) - 32px - 80px - 48px)' }}>
              <div className="academy-main" style={{ overflowY: 'auto' }}>
                {renderAcademyCallList()}
              </div>
              <div className="academy-sidebar">
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title">Training Collections</div>
                  <div id="academy-collections">{['Disclosure Excellence', 'Discovery Masters', 'Common Mistakes', 'Featured Calls', 'Objection Handlers'].map(name => (<div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => showToast('info', 'Collection Filter', `Showing calls in "${name}"`, setToasts)}><span className="fs-11 text-muted">{name}</span><span className="font-mono fs-11 fw-600">{Math.floor(Math.random() * 8) + 2}</span></div>))}</div>
                  <button className="filter-btn" style={{ width: '100%', marginTop: '8px', fontSize: '11px' }} onClick={() => showToast('info', 'New Collection', 'Create a named training collection for your team.', setToasts)}>+ New Collection</button>
                </div>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title">Marker Types</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }}></div><span className="fs-11 text-muted" style={{ flex: 1 }}>Green — Best practice moment</span></div>
                    <div className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }}></div><span className="fs-11 text-muted" style={{ flex: 1 }}>Gold — Key scripted moment</span></div>
                    <div className="flex items-center gap-8" style={{ padding: '6px 0' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }}></div><span className="fs-11 text-muted" style={{ flex: 1 }}>Red — Do not replicate</span></div>
                  </div>
                </div>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="split-sidebar-title">Auto-Tag Logic</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: '1.7' }}>
                    <div style={{ padding: '6px', background: 'var(--green-dim)', borderRadius: 'var(--radius)', marginBottom: '6px', borderLeft: '2px solid var(--green)' }}>Score ≥ <strong className="text-green">85</strong> → Exemplar (auto-flagged nightly)</div>
                    <div style={{ padding: '6px', background: 'var(--red-dim)', borderRadius: 'var(--radius)', marginBottom: '6px', borderLeft: '2px solid var(--red)' }}>Score ≤ <strong className="text-red">35</strong> → Warning (auto-flagged nightly)</div>
                    <div style={{ padding: '6px', background: 'var(--gold-dim)', borderRadius: 'var(--radius)', borderLeft: '2px solid var(--gold)' }}>Manual <strong className="text-gold">Featured</strong> tag by floor manager</div>
                  </div>
                </div>
                <div style={{ padding: '12px' }}>
                  <div className="split-sidebar-title">Recent Activity</div>
                  <div id="academy-activity">
                    <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: '13px', flexShrink: 0 }}>⭐</span><div><div className="fs-11" style={{ color: 'var(--text2)', lineHeight: '1.4' }}>Summer Spence — tagged Exemplar</div><div className="fs-10 text-muted">2m ago</div></div></div>
                    <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: '13px', flexShrink: 0 }}>⏱</span><div><div className="fs-11" style={{ color: 'var(--text2)', lineHeight: '1.4' }}>Marker added: "Great Opening" at 1:22 — Kaila Minarcin</div><div className="fs-10 text-muted">8m ago</div></div></div>
                    <div style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: '13px', flexShrink: 0 }}>📁</span><div><div className="fs-11" style={{ color: 'var(--text2)', lineHeight: '1.4' }}>3 calls added to Disclosure Excellence</div><div className="fs-10 text-muted">14m ago</div></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SDR Pipeline Page */}
          <div className={`page ${activePage === 'sdr-pipeline' ? 'active' : ''}`}>
            <div className="section-hdr">
              <div><span className="section-hdr-title">SDR → Closer Pipeline</span><span className="fs-11 text-muted" style={{ marginLeft: '10px' }}>14-Day Readiness Tracker · City Financial Promotion System</span></div>
              <div className="section-hdr-actions">
                <div className="lb-toggle">
                  <button className={`lb-toggle-btn ${sdrView === 'board' ? 'active' : ''}`} onClick={() => sdrViewChange('board')}>Board</button>
                  <button className={`lb-toggle-btn ${sdrView === 'table' ? 'active' : ''}`} onClick={() => sdrViewChange('table')}>Table</button>
                  <button className={`lb-toggle-btn ${sdrView === 'strategy' ? 'active' : ''}`} onClick={() => sdrViewChange('strategy')}>Strategy</button>
                </div>
                <button className="topbar-btn primary" onClick={() => showPromoteModal()}>🚀 Promote to Closer</button>
              </div>
            </div>

            {sdrView === 'board' && renderSDRCards()}
            {sdrView === 'table' && renderSDRTable()}
            {sdrView === 'strategy' && renderSDRStrategy()}

            <div className="sdr-sidebar" style={{ position: 'fixed', right: 0, top: 'var(--topbar-h)', width: '300px', height: 'calc(100vh - var(--topbar-h))' }}>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                <div className="split-sidebar-title">This Week's Decisions</div>
                <div id="sdr-decisions">
                  {sdrAgents.filter(a => a.day >= 14).map(a => (
                    <div key={a.name} style={{ padding: '8px', border: `1px solid ${a.status === 'READY' ? 'rgba(46,204,142,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius)', marginBottom: '6px', background: a.status === 'READY' ? 'var(--green-dim)' : 'var(--bg3)' }}>
                      <div className="fs-12 fw-600 mb-12">{a.name}</div>
                      <div className="fs-11 text-muted">Readiness: <strong style={{ color: a.readiness >= 72 ? 'var(--green)' : a.readiness >= 55 ? 'var(--gold)' : 'var(--red)' }}>{a.readiness}/100</strong></div>
                      <div style={{ marginTop: '6px' }}><span className={`promo-badge ${a.status}`} style={{ fontSize: '9px' }}>{a.status.replace('_', ' ')}</span></div>
                    </div>
                  ))}
                  {sdrAgents.filter(a => a.day >= 14).length === 0 && <div className="fs-11 text-muted">No SDRs at Day 14 this week</div>}
                </div>
              </div>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                <div className="split-sidebar-title">Readiness Distribution</div>
                <div id="sdr-distribution">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="progress-row"><div className="progress-label" style={{ color: 'var(--green)' }}>✅ Ready</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${(sdrAgents.filter(a => a.status === 'READY').length / sdrAgents.length) * 100}%`, background: 'var(--green)' }}></div></div><div className="progress-val text-green">{sdrAgents.filter(a => a.status === 'READY').length}</div></div>
                    <div className="progress-row"><div className="progress-label" style={{ color: 'var(--gold)' }}>⚠️ Watch</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${(sdrAgents.filter(a => a.status === 'WATCH').length / sdrAgents.length) * 100}%`, background: 'var(--gold)' }}></div></div><div className="progress-val text-gold">{sdrAgents.filter(a => a.status === 'WATCH').length}</div></div>
                    <div className="progress-row"><div className="progress-label text-muted">🕐 Not Yet</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${(sdrAgents.filter(a => a.status === 'NOT_YET').length / sdrAgents.length) * 100}%`, background: 'var(--border3)' }}></div></div><div className="progress-val">{sdrAgents.filter(a => a.status === 'NOT_YET').length}</div></div>
                    <div className="progress-row"><div className="progress-label" style={{ color: 'var(--purple)' }}>⭐ Promoted</div><div className="mini-bar-wrap"><div className="mini-bar" style={{ width: `${(sdrAgents.filter(a => a.status === 'PROMOTED').length / sdrAgents.length) * 100}%`, background: 'var(--purple)' }}></div></div><div className="progress-val" style={{ color: 'var(--purple)' }}>{sdrAgents.filter(a => a.status === 'PROMOTED').length}</div></div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                <div className="split-sidebar-title">Academy Suggested</div>
                <div className="fs-11 text-muted" style={{ marginBottom: '8px', lineHeight: '1.5' }}>Exemplar calls matched to SDR's weakest checkpoint</div>
                <div id="sdr-academy-match">
                  {sdrAgents.slice(0, 3).map(a => {
                    const dims = [
                      { name: 'Disclosures', val: a.dims.discDim },
                      { name: 'Talk Ratio', val: a.dims.talkDim },
                      { name: 'Objections', val: a.dims.objDim },
                      { name: 'Bad Trackers', val: a.dims.badDim },
                    ];
                    const worst = dims.sort((x, y) => x.val - y.val)[0];
                    const exemplar = academyCalls.find(c => c.academyTag === 'exemplar');
                    return (
                      <div key={a.name} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="fs-11 fw-600" style={{ color: 'var(--text)' }}>{a.name}</div>
                        <div className="fs-10 text-muted">Weakest: <strong style={{ color: 'var(--gold)' }}>{worst.name}</strong></div>
                        {exemplar && <div className="fs-10 text-muted" style={{ marginTop: '3px' }}>→ Play: <span style={{ color: 'var(--green)', cursor: 'pointer' }} onClick={() => showToast('info', 'Playing Exemplar', `Opening call by ${exemplar.agentName}...`, setToasts)}>{exemplar.agentName} ({exemplar.score})</span></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: '12px' }}>
                <div className="split-sidebar-title">Closer Floor Openings</div>
                <div id="sdr-openings">
                  <div style={{ padding: '8px', background: 'var(--green-dim)', border: '1px solid rgba(46,204,142,0.2)', borderRadius: 'var(--radius)' }}>
                    <div className="fs-12 fw-700 text-green mb-12">2 Closer Seats Open</div>
                    <div className="fs-11 text-muted" style={{ lineHeight: '1.6' }}>Floor has capacity for 2 additional Jr Closers. {sdrAgents.filter(a => a.status === 'READY').length} SDR{sdrAgents.filter(a => a.status === 'READY').length !== 1 ? 's' : ''} currently meet all promotion criteria.</div>
                    {sdrAgents.filter(a => a.status === 'READY').length > 0 && <button className="filter-btn" style={{ width: '100%', marginTop: '8px', fontSize: '11px', color: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => showPromoteModal()}>🚀 Initiate Promotions</button>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Board Pages */}
          <div className={`page ${activePage === 'accounting' ? 'active' : ''}`}>{renderAccountingPage()}</div>
          <div className={`page ${activePage === 'debt-board' ? 'active' : ''}`}>{renderDebtBoardPage()}</div>
          <div className={`page ${activePage === 'finance-board' ? 'active' : ''}`}>{renderFinanceBoardPage()}</div>
          <div className={`page ${activePage === 'bbb' ? 'active' : ''}`}>{renderBbbPage()}</div>
          <div className={`page ${activePage === 'marketing' ? 'active' : ''}`}>{renderMarketingPage()}</div>
          <div className={`page ${activePage === 'tax-debt-backend' ? 'active' : ''}`}>{renderTaxDebtBackendPage()}</div>
          <div className={`page ${activePage === 'tax-prep' ? 'active' : ''}`}>{renderTaxPrepPage()}</div>
          <div className={`page ${activePage === 'zendesk' ? 'active' : ''}`}>{renderZendeskPage()}</div>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal-overlay ${modalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeScorecard(); }}>
        <div className="modal">
          <div className="modal-hdr">
            <div>
              <div className="modal-agent-name">{selectedCall?.agentName || 'Agent Name'}</div>
              <div className="modal-meta">{selectedCall ? `${selectedCall.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${selectedCall.duration} · ${selectedCall.campaign}` : ''}</div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                {selectedCall?.flags.map(f => <span key={f} className="badge red" style={{ fontSize: '10px' }}>{f}</span>)}
                {selectedCall && <span className={`badge ${outcomeClass(selectedCall.outcome)}`}>{selectedCall.outcome}</span>}
                {selectedCall && <span className="badge grey">{selectedCall.agentDept}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div className={`modal-score-badge ${selectedCall ? scoreClass(selectedCall.score) : ''}`}>{selectedCall?.score || '—'}</div>
              <button className="modal-close" onClick={closeScorecard}>✕</button>
            </div>
          </div>
          <div className="modal-tabs">
            <button className={`modal-tab ${modalTab === 'overview' ? 'active' : ''}`} onClick={() => changeModalTab('overview')}>Overview</button>
            <button className={`modal-tab ${modalTab === 'trackers' ? 'active' : ''}`} onClick={() => changeModalTab('trackers')}>Trackers</button>
            <button className={`modal-tab ${modalTab === 'ai-coach' ? 'active' : ''}`} onClick={() => changeModalTab('ai-coach')}>AI Coach</button>
            <button className={`modal-tab ${modalTab === 'summary' ? 'active' : ''}`} onClick={() => changeModalTab('summary')}>Call Summary</button>
          </div>
          <div className="modal-body">
            {renderModalContent()}
          </div>
          <div className="modal-actions">
            <button className="modal-btn primary" onClick={saveScorecard}>💾 Save Scorecard</button>
            <button className="modal-btn outline" onClick={shareScorecard}>↗ Share</button>
            <button className="modal-btn outline" style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={flagCall}>🚩 Flag Call</button>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <div className="alert-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`alert-toast ${toast.type === 'critical' ? 'critical' : toast.type === 'warning' ? 'warning' : ''}`}>
            <span className="toast-icon">{toast.type === 'critical' ? '🚨' : toast.type === 'warning' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
            <div><div className="toast-title">{toast.title}</div><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-dismiss" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;