// Everything the site says lives in this file. Edit the text here; the layout
// and animation pick it up automatically.
//
// Any list can be longer or shorter, and a section whose list is empty is left
// off the page (and out of the nav). Fields left as '' are simply not shown.

export const CONTENT = {
  /* ---------- splash screen ---------- */
  splash: {
    taglines: ['doot doot', 'bones, but shiny', 'powered by calcium', 'certified spooky', 'dootlord.meme'],
    // Buttons under the title. Leave empty to hide the row.
    links: [
      { label: 'Blog', href: 'blog/' },
      { label: 'GitHub', href: 'https://github.com/DootLord' },
    ],
    // One is picked at random per skull click. A static page can't list a
    // folder, so add new files from audio/ here.
    sounds: ['audio/doot-dan.mp3', 'audio/doot-becca.mp3', 'audio/doot-jack.mp3'],
    soundVolume: 0.7,
  },

  /* ---------- about / background ---------- */
  about: {
    name: 'DootLord',
    role: 'Software Engineer',
    bio: [
      'Software engineer with 8+ years of professional experience delivering and operating production software, mostly in TypeScript, Node.js, React, Angular, PHP and SQL on cloud-hosted infrastructure.',
      'Broad full-stack background, from frontend and APIs to real-time systems, CI/CD and production support. Comfortable taking an unfamiliar problem from first requirement through to production, working directly with stakeholders and supporting other engineers.',
    ],
    // The quick-facts box. Any label / value pairs you like.
    stats: [
      { label: 'Class', value: 'Full-stack engineer' },
      { label: 'Experience', value: '8+ years' },
      { label: 'Main stack', value: 'TypeScript / Node.js' },
      { label: 'Also', value: 'Technical leadership' },
      { label: 'Status', value: 'Currently employed' },
    ],
    education: [
      { title: 'BSc Computer Science', place: '', period: '' },
    ],
  },

  /* ---------- abilities ---------- */
  skills: [
    { group: 'Software engineering', items: ['TypeScript', 'JavaScript', 'Node.js', 'React', 'Angular', 'PHP', 'REST APIs'] },
    { group: 'Data & integrations', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'WebSockets', 'SSO / JWT'] },
    { group: 'Cloud & delivery', items: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Grafana'] },
    { group: 'Engineering practice', items: ['Code review', 'Mentoring', 'Unit testing', 'Performance debugging', 'Production support'] },
    { group: 'Gaming', items: ['Mono-black enthusiast', 'WoW Forever enjoyer', 'Deadlock Abrams', 'Minecraft Create fan'] },
    { group: 'Other talents', items: ['Guitarist', 'Hand farter', 'Pack opener', 'Skeleton enthusiast'] },
  ],

  /* ---------- career, newest first ---------- */
  experience: [
    {
      role: 'Full Stack Developer',
      company: 'An eLearning platform company',
      period: '2020 — 2026',
      location: '',
      summary: 'Built and ran production software end to end across a modern TypeScript/Node.js platform and a legacy PHP estate, growing into technical leadership along the way.',
      points: [
        'Helped rewrite a fragile legacy JavaScript courseware application into a maintainable React system built from reusable components.',
        'Built REST APIs and customer integrations with Node.js/Express, including SSO, JWT authentication, access controls and audit logging.',
        'Designed real-time workflows with WebSockets and background workers, such as notifying users in-browser when queued reports finished.',
        'Built an internal AI-assisted translation tool that converts large eLearning courses into 100+ languages in minutes.',
        'Picked up Cordova from scratch to ship a production mobile app in under a month; it is still used by 1,000+ Android users.',
        'Took on technical leadership: prioritising work with stakeholders, making release decisions, leading code reviews, interviewing and mentoring.',
      ],
      tags: ['TypeScript', 'Node.js', 'React', 'Angular', 'PHP', 'AWS', 'Docker'],
    },
    {
      role: 'Full Stack Developer',
      company: 'A digital agency',
      period: '2020',
      location: '',
      summary: 'Two-person team delivering configurable WordPress sites for multiple clients, turning supplied designs into working production sites.',
      points: [],
      tags: ['WordPress', 'Gutenberg'],
    },
    {
      role: 'Junior Developer',
      company: 'A market research company',
      period: '2019',
      location: '',
      summary: 'Six-person agile team maintaining internal authentication and survey-management services, contributing security improvements, UI components and application changes.',
      points: [],
      tags: ['PHP', 'Node.js', 'MySQL'],
    },
    {
      role: 'Web Developer',
      company: 'A university IT department',
      period: '2017 — 2018',
      location: '',
      summary: 'Co-created and maintained operational tools for IT staff, including query logging, check-in, stock and inventory systems.',
      points: [],
      tags: ['PHP', 'MySQL', 'Node.js', 'Electron'],
    },
  ],

  /* ---------- projects ---------- */
  projects: [
    {
      name: 'Eden',
      blurb: 'An EVE Online-inspired game that runs in the browser, with large real-time persistent battles, buildings, an economy and more.',
      tags: ['Browser game', 'Real-time', 'Persistent world'],
      href: '',
    },
    {
      name: 'Catalyst',
      blurb: 'A FiveM (GTA V multiplayer) server that I host myself and build the content for from scratch.',
      tags: ['FiveM', 'Self-hosted'],
      href: '',
    },
    {
      name: 'Florbs',
      blurb: 'A loot-box opening game, built full stack.',
      tags: ['Game', 'Full stack'],
      href: '',
    },
    {
      name: 'Mobile AI assistant',
      blurb: 'An AI assistant for my phone that integrates with tools and talks to my own API directly.',
      tags: ['AI', 'Mobile'],
      href: '',
    },
  ],

  /* ---------- personal ---------- */
  personal: [
    { title: 'Modding', text: 'Contributed bug fixes to the Ultimate Apocalypse mod for Dawn of War – Soulstorm, merged and shipped in releases.' },
    { title: 'Self-hosting', text: 'Running my own containerised services, with Cloudflare out front.' },
    { title: 'Currently learning', text: 'Go, and going deeper on cloud and container topics.' },
  ],

  /* ---------- contact ---------- */
  contact: {
    blurb: 'Not looking for new career opportunities, but always up for collaborating. If you have an idea or want to build something together, reach out on GitHub.',
    links: [
      { label: 'GitHub', href: 'https://github.com/DootLord' },
    ],
  },
};
