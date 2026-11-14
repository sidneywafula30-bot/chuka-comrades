/**
 * Free online course providers (17). There is no single public API for all of them, so each provider is opened at
 * its own catalogue or search page. Where a provider has no search page we fall back to a Google "site:" search.
 * Access notes are indicative: always check the exact course terms before enrolling.
 */
export type CourseProvider = {
  id: string; name: string; type: 'University' | 'Free learning platform' | 'Professional skills' | 'MOOC platform'
  domain: string; about: string; access: string
  /** Catalogue URL. If `search` is true this URL ends with the query parameter and the phrase is appended. */
  url: string; search: boolean
  /** Brand colour for the initials fallback. */
  color: string
}

export const COURSE_PROVIDERS: CourseProvider[] = [
  { id: 'mit-ocw', name: 'MIT OpenCourseWare', type: 'University', domain: 'ocw.mit.edu', about: 'Free MIT course materials, lecture notes and selected video lectures.', access: 'Free course materials; not every course has a certificate.', url: 'https://ocw.mit.edu/search/?q=', search: true, color: '#A31F34' },
  { id: 'yale', name: 'Open Yale Courses', type: 'University', domain: 'oyc.yale.edu', about: 'Selected Yale courses with lectures, syllabi and readings.', access: 'Free open materials; generally no certificate.', url: 'https://oyc.yale.edu/', search: false, color: '#00356B' },
  { id: 'harvard', name: 'Harvard Online', type: 'University', domain: 'pll.harvard.edu', about: 'Online courses and learning opportunities from Harvard.', access: 'Some free options; many courses or certificates are paid.', url: 'https://pll.harvard.edu/catalog', search: false, color: '#A51C30' },
  { id: 'stanford', name: 'Stanford Online', type: 'University', domain: 'online.stanford.edu', about: 'Stanford online courses, programmes and resources.', access: 'Mix of free resources and paid courses.', url: 'https://online.stanford.edu/explore', search: false, color: '#8C1515' },
  { id: 'khan', name: 'Khan Academy', type: 'Free learning platform', domain: 'khanacademy.org', about: 'Free lessons and practice in maths, science, computing, economics and more.', access: 'Free learning content.', url: 'https://www.khanacademy.org/search?page_search_query=', search: true, color: '#14BF96' },
  { id: 'saylor', name: 'Saylor Academy', type: 'Free learning platform', domain: 'saylor.org', about: 'Self-paced courses in business, computer science and general education.', access: 'Free courses; check each course for certificate conditions.', url: 'https://www.saylor.org/courses/', search: false, color: '#1F5FA8' },
  { id: 'freecodecamp', name: 'freeCodeCamp', type: 'Professional skills', domain: 'freecodecamp.org', about: 'Free coding curriculum, projects and certifications.', access: 'Free curriculum and certifications.', url: 'https://www.freecodecamp.org/learn/', search: false, color: '#0A0A23' },
  { id: 'openlearn', name: 'OpenLearn (Open University)', type: 'University', domain: 'open.edu/openlearn', about: 'Free courses and learning resources from The Open University.', access: 'Free; some offer a free statement of participation or badge.', url: 'https://www.open.edu/openlearn/', search: false, color: '#003B7B' },
  { id: 'microsoft', name: 'Microsoft Learn', type: 'Professional skills', domain: 'learn.microsoft.com', about: 'Free technical learning paths and modules for Microsoft technologies.', access: 'Learning content is free; exams and some credentials cost money.', url: 'https://learn.microsoft.com/en-us/training/browse/?terms=', search: true, color: '#0078D4' },
  { id: 'google', name: 'Google Learning & Career', type: 'Professional skills', domain: 'grow.google', about: 'Digital skills, career training and Google learning resources.', access: 'Free and paid options vary by programme and country.', url: 'https://grow.google/intl/en/courses-and-tools/', search: false, color: '#4285F4' },
  { id: 'ibm', name: 'IBM SkillsBuild', type: 'Professional skills', domain: 'skillsbuild.org', about: 'Free learning in technology, workplace skills and career readiness.', access: 'Free learning and selected credentials; eligibility may apply.', url: 'https://skillsbuild.org/', search: false, color: '#0F62FE' },
  { id: 'aws', name: 'AWS Skill Builder', type: 'Professional skills', domain: 'skillbuilder.aws', about: 'Cloud computing training, learning plans and exam preparation.', access: 'Includes free digital training; some courses and labs are paid.', url: 'https://skillbuilder.aws/', search: false, color: '#FF9900' },
  { id: 'coursera', name: 'Coursera', type: 'MOOC platform', domain: 'coursera.org', about: 'Courses and professional certificates from universities and companies.', access: 'Some courses can be audited free; certificates usually cost extra.', url: 'https://www.coursera.org/search?query=', search: true, color: '#0056D2' },
  { id: 'edx', name: 'edX', type: 'MOOC platform', domain: 'edx.org', about: 'University and institution courses across many subjects.', access: 'Some courses can be audited free; verified certificates usually cost extra.', url: 'https://www.edx.org/search?q=', search: true, color: '#02262B' },
  { id: 'futurelearn', name: 'FutureLearn', type: 'MOOC platform', domain: 'futurelearn.com', about: 'Short courses and programmes from universities and organisations.', access: 'Free access may be time-limited; upgrades and certificates cost extra.', url: 'https://www.futurelearn.com/search?q=', search: true, color: '#DE00A5' },
  { id: 'udacity', name: 'Udacity', type: 'MOOC platform', domain: 'udacity.com', about: 'Technology and career-focused learning content.', access: 'Mix of free courses and paid programmes.', url: 'https://www.udacity.com/courses/all', search: false, color: '#02B3E4' },
  { id: 'alison', name: 'Alison', type: 'MOOC platform', domain: 'alison.com', about: 'Online courses in business, technology, health and personal development.', access: 'Many courses are free to study; certificates and downloads cost extra.', url: 'https://alison.com/courses', search: false, color: '#2D9CDB' },
]

export const PROVIDER_TYPES = ['All types', 'University', 'Free learning platform', 'Professional skills', 'MOOC platform'] as const

/** Where "Search <phrase> on <provider>" goes. */
export function providerLink(p: CourseProvider, phrase: string): { href: string; mode: 'search' | 'google' | 'browse' } {
  const q = phrase.trim()
  if (!q) return { href: p.url.replace(/[?&](q|query|terms|page_search_query)=$/, ''), mode: 'browse' }
  if (p.search) return { href: p.url + encodeURIComponent(q), mode: 'search' }
  return { href: `https://www.google.com/search?q=${encodeURIComponent(`site:${p.domain} ${q}`)}`, mode: 'google' }
}
