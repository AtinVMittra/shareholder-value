// All of the game's satirical text lives here so it is easy to edit.

export const RANKS = [
  { title: 'Intern', at: 0, blurb: 'Unpaid in money. Paid in exposure.' },
  { title: 'Associate', at: 25, blurb: 'You now have a badge that opens one more door.' },
  { title: 'Senior Associate', at: 100, blurb: 'Same job. Longer title. More meetings.' },
  { title: 'Staff Value Driver', at: 250, blurb: 'Nobody knows what you do. That is the point.' },
  { title: 'Principal Synergist', at: 500, blurb: 'You are now a stakeholder. Watch your back.' },
  { title: 'Distinguished Thought Leader', at: 1000, blurb: 'The Earnings Call is live. The Executive Floor awaits.' },
];

export const Q = {
  quickask: [
    'Got a sec? It is a quick one.',
    'Can you just quickly rebuild the whole thing?',
    'Not urgent! But by end of day.',
    'Pinging you here since you ignored my ping.',
    'Small ask. Tiny. Two sprints, tops.',
    'Did you see my message? I sent it eleven seconds ago.',
    'Looping you in for visibility.',
  ],
  evangelist: [
    'We are piloting a new tool!',
    'It is like the old tool, but with AI.',
    'Adoption is mandatory. Enjoyment is optional.',
    'Migrate everything by Friday.',
    'This replaces the thing that replaced the last thing.',
    'There is a 40-minute onboarding video.',
  ],
  process: [
    'Did you file a request to file that request?',
    'This needs sign-off from the sign-off committee.',
    'We have a process for changing the process.',
    'Please use the correct template.',
    'That is out of scope for the scope document.',
  ],
  processDrop: ['Form incoming!', 'Fill this out in triplicate.', 'Approval workflow initiated.'],
  magnet: [
    'Let us hop on a quick sync.',
    'This could have been an email. It will not be.',
    'I blocked two hours for alignment.',
    'Can everyone see my screen?',
    'Let us take it offline. Into another meeting.',
    'You are on mute.',
  ],
  aibot: ['Scheduling a meeting about that.', 'I have automated your lunch break.', 'Summarizing your summary.'],
  reorg: [
    'Change is our only constant.',
    'We are flattening the org. Vertically.',
    'Your team is now a tribe inside a squad inside a guild.',
    'Think of it as an opportunity.',
  ],
  reorgToast: [
    'REORG! You now report to a different desk.',
    'REORG! Your manager is now your skip-level\'s intern.',
    'REORG! Everyone moved. Nothing changed.',
  ],
  legacy: [
    'UPTIME: 9 YEARS. DOCUMENTATION: NONE.',
    'DO NOT TOUCH. NOBODY KNOWS WHY THIS WORKS.',
    'THE ONE PERSON WHO UNDERSTOOD ME LEFT IN 2019.',
  ],
  cvo: [
    'We are a family. A family with quarterly targets.',
    'I had a vision on my retreat.',
    'Do more with less. Then do more with that.',
    'This is not a layoff. It is a talent rebalancing.',
  ],
  cvoPhases: [
    { title: 'AI-FIRST PIVOT', sub: 'Every problem is now an agent. Including you.' },
    { title: 'RETURN-TO-OFFICE MANDATE', sub: 'Collaboration happens within a seven-meter radius.' },
    { title: 'SYNERGY OVERDRIVE', sub: 'All hands. All the time.' },
  ],
  ally: ['On it!', 'Happy to take that off your plate.', 'I will circle back with myself.'],
  ticketClosed: [
    'Ticket closed. Follow-ups created automatically.',
    'Great work! That unblocked several new blockers.',
    'Done means done, pending three more tickets.',
    'You finished early, so here is more.',
  ],
  coffee: [
    'Coffee acquired. Burnout postponed.',
    'Cold brew. Warm feelings. Brief ones.',
    'Caffeine: the original productivity tool.',
  ],
  slow: 'Onboarding required: complete 14 modules to regain velocity.',
  stun: 'Form submitted. Pending approval from the approver\'s approver.',
  pto: 'Unlimited PTO acquired! Manager approval pending. Forever.',
  noDelegate: 'Nobody nearby to delegate to. Classic.',
  pause: 'Strategic Pause: you are "taking this offline".',
};

export const POSTERS = [
  ['WE ARE A', 'FAMILY', '(terms apply)'],
  ['MOVE FAST', 'AND FILE', 'TICKETS'],
  ['SYNERGY'],
  ['AI-FIRST', 'HUMANS', 'SECOND'],
  ['DO MORE', 'WITH LESS'],
  ['THIS MEETING', 'IS A', 'SAFE SPACE'],
  ['HUSTLE', 'MINDFULLY'],
  ['FAIL FAST', '(not you)'],
];

export const ROOM_NAMES = ['Synergy', 'Alignment', 'Circle Back', 'Deep Dive'];

export const ENDINGS = {
  burnout: {
    title: 'YOU BURNED OUT',
    sub: 'HR has sent you a link to a wellness webinar. Attendance is mandatory.',
  },
  missed: {
    title: 'GUIDANCE MISSED',
    sub: 'The quarter ended below $1B. You have been impacted by a strategic workforce realignment.',
  },
  win: {
    title: 'SHAREHOLDER VALUE DELIVERED',
    sub: 'The Chief Vision Officer has left to "spend more time with his podcast". Your reward: a pizza party and his job.',
  },
};
