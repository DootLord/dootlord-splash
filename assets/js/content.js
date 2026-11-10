// Everything the site says lives in this file. Edit the text here; the layout
// and animation pick it up automatically.
//
// Anything in [square brackets] is a placeholder to replace. Any list can be
// longer or shorter, and a section whose list is empty is left off the page
// (and out of the nav).

export const CONTENT = {
  /* ---------- splash screen ---------- */
  splash: {
    taglines: ['doot doot', 'bones, but shiny', 'powered by calcium', 'certified spooky', 'dootlord.meme'],
    // Buttons under the title. Leave empty to hide the row.
    links: [
      { label: 'GitHub', href: 'https://github.com/DootLord' },
    ],
    // One is picked at random per skull click. A static page can't list a
    // folder, so add new files from audio/ here.
    sounds: ['audio/doot-dan.mp3', 'audio/doot-becca.mp3'],
    soundVolume: 0.7,
  },

  /* ---------- about / background ---------- */
  about: {
    name: '[Your Name]',
    role: '[Your job title]',
    bio: [
      '[A short paragraph about who you are and what you do. Two or three sentences is plenty: what you work on, what you care about, what you are known for.]',
      '[A second paragraph on your background: how you got here, the kind of teams or problems you like, what you are looking for next.]',
    ],
    // The quick-facts box. Any label / value pairs you like.
    stats: [
      { label: 'Class', value: '[Job title]' },
      { label: 'Based in', value: '[City, Country]' },
      { label: 'Experience', value: '[N] years' },
      { label: 'Focus', value: '[What you do best]' },
      { label: 'Status', value: '[Open to offers / Happily employed]' },
    ],
    education: [
      { title: '[Qualification or degree]', place: '[School / University]', period: '[Year] — [Year]' },
      { title: '[Certification or course]', place: '[Issuer]', period: '[Year]' },
    ],
  },

  /* ---------- abilities ---------- */
  skills: [
    { group: '[Languages]', items: ['[Skill]', '[Skill]', '[Skill]', '[Skill]'] },
    { group: '[Frameworks]', items: ['[Skill]', '[Skill]', '[Skill]'] },
    { group: '[Tools & platforms]', items: ['[Skill]', '[Skill]', '[Skill]', '[Skill]', '[Skill]'] },
    { group: '[Ways of working]', items: ['[Skill]', '[Skill]', '[Skill]'] },
  ],

  /* ---------- career, newest first ---------- */
  experience: [
    {
      role: '[Current job title]',
      company: '[Company]',
      period: '[Year] — Present',
      location: '[City / Remote]',
      summary: '[One or two sentences on what the role is and what you are responsible for.]',
      points: [
        '[Something you built, shipped or improved, ideally with a result.]',
        '[Another concrete thing you did.]',
        '[A third, if it earns its place.]',
      ],
      tags: ['[Tech]', '[Tech]', '[Tech]'],
    },
    {
      role: '[Previous job title]',
      company: '[Company]',
      period: '[Year] — [Year]',
      location: '[City / Remote]',
      summary: '[One or two sentences on the role.]',
      points: [
        '[Something you built, shipped or improved.]',
        '[Another concrete thing you did.]',
      ],
      tags: ['[Tech]', '[Tech]'],
    },
    {
      role: '[Earlier job title]',
      company: '[Company]',
      period: '[Year] — [Year]',
      location: '[City / Remote]',
      summary: '[One or two sentences on the role.]',
      points: [],
      tags: ['[Tech]'],
    },
  ],

  /* ---------- projects ---------- */
  projects: [
    { name: '[Project name]', blurb: '[What it is and why it is interesting.]', tags: ['[Tech]', '[Tech]'], href: '' },
    { name: '[Project name]', blurb: '[What it is and why it is interesting.]', tags: ['[Tech]'], href: '' },
    { name: '[Project name]', blurb: '[What it is and why it is interesting.]', tags: ['[Tech]', '[Tech]'], href: '' },
  ],

  /* ---------- personal ---------- */
  personal: [
    { title: '[Hobby or interest]', text: '[A sentence or two. What you get up to away from the keyboard.]' },
    { title: '[Hobby or interest]', text: '[A sentence or two.]' },
    { title: '[Hobby or interest]', text: '[A sentence or two.]' },
  ],

  /* ---------- contact ---------- */
  contact: {
    blurb: '[How you would like people to get in touch, and what about.]',
    links: [
      { label: 'Email', href: 'mailto:you@example.com' },
      { label: 'GitHub', href: 'https://github.com/DootLord' },
      { label: 'LinkedIn', href: '' },
    ],
  },
};
