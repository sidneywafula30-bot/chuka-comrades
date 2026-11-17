/**
 * Chuka University programmes, taken from the university's own "Academic Programmes" list
 * (issued July 2026, www.chuka.ac.ke). Fees are TUITION ONLY and exclude statutory fees.
 * Always confirm on the official site before applying: programmes, fees and intakes can change.
 *
 * To refresh: open the official list (CHUKA_LINKS.programmesPdf), then edit the rows below.
 */
export type CuLevel = 'Certificate' | 'Diploma' | 'Bachelor’s' | 'Postgraduate diploma' | 'Short course' | 'Master’s' | 'PhD'
export type Goal = 'earning' | 'interest' | 'health' | 'hobby'

export type CuCourse = {
  id: string
  name: string
  level: CuLevel
  faculty: string
  duration: string
  fee: string
  campus: string
  entry: string
  /** Search phrase for free lessons that help a student prepare for this subject. */
  topic: string
  /** Which "goal" lenses this programme fits (derived automatically). */
  goals: Goal[]
}

export const CHUKA_LINKS = {
  site: 'https://www.chuka.ac.ke/',
  courseList: 'https://www.chuka.ac.ke/course-list-2/',
  apply: 'https://admissions.chuka.ac.ke',
  programmesPdf: 'https://www.chuka.ac.ke/storage/2026/07/CU-Advert-May-2026-F-1-1_compressed.pdf',
}

export const CU_FACULTIES = [
  'School of Nursing and Public Health',
  'Faculty of Science and Technology',
  'Faculty of Engineering',
  'Faculty of Business Studies',
  'Faculty of Education and Resources Development',
  'Faculty of Agriculture',
  'Faculty of Environmental Studies and Resources Development',
  'Faculty of Humanities and Social Sciences',
  'School of Law',
] as const

const NUR = CU_FACULTIES[0], SCI = CU_FACULTIES[1], ENG = CU_FACULTIES[2], BUS = CU_FACULTIES[3], EDU = CU_FACULTIES[4]
const AGR = CU_FACULTIES[5], ENV = CU_FACULTIES[6], HUM = CU_FACULTIES[7], LAW = CU_FACULTIES[8]

const ALL = 'All campuses (Main, Embu, Igembe, Chogoria)'
const MAIN = 'Main (Chuka)'

type Row = [name: string, faculty: string, duration: string, fee: string, campus: string, entry: string, topic?: string]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Goal lenses are worked out from the programme name and faculty, so new rows need no extra tagging. */
function goalsFor(name: string, faculty: string, level: CuLevel): Goal[] {
  const n = `${name} ${faculty}`.toLowerCase()
  const g: Goal[] = []
  if (/nurs|health|nutrition|dietet|psycholog|counsel|biomedical|hiv|social work|parasit|clinical|fitness/.test(n)) g.push('health')
  if (/business|account|financ|procure|entrepren|market|cooperative|agribusiness|computer|software|information tech|journalism|tourism|hotel|aviation|air travel|landscap|horticult|engineer|insurance|sales|enterprise|food|animal products|renewable|supply|commerce/.test(n)) g.push('earning')
  if (/music|art|literature|linguistic|kiswahili|french|philosoph|history|geography|communication|journalism|ecotourism|wildlife|religious|sociology|physics|chemistry|biology|mathematics|astro|language|english/.test(n) && level !== 'Short course') g.push('interest')
  if (/landscap|ecotourism|wildlife|french|kiswahili|literature|journalism|communication|hotel|tourism|horticult/.test(n)) g.push('hobby')
  return g
}

function build(level: CuLevel, rows: Row[]): CuCourse[] {
  return rows.map(([name, faculty, duration, fee, campus, entry, topic]) => ({
    id: `${slug(level)}-${slug(name)}`,
    name, level, faculty, duration, fee, campus, entry,
    topic: topic ?? name.replace(/^(Bachelor of (Science|Arts)?( in)?|Bachelor of|BSc in|Diploma in|Certificate in|Post-?graduate Diploma in)\s*/i, '').replace(/\(.*?\)/g, '').trim(),
    goals: goalsFor(name, faculty, level),
  }))
}

/* ------------------------------------------------------------------ BACHELOR'S ------------------------------------------------------------------ */
const sciFee = '55,000 per semester'
const bachelors = build('Bachelor’s', [
  // School of Nursing and Public Health
  ['Bachelor of Science in Nursing (Basic)', NUR, '8 semesters, full-time (September intake only)', '70,000 per session, 3 sessions a year', MAIN, 'KCSE mean C+ with C+ in English/Kiswahili, Biology, Chemistry and Maths/Physics (or KACE equivalent).', 'nursing fundamentals'],
  ['Bachelor of Science in Nursing (Upgrading)', NUR, '8 trimesters (January intake only)', '58,000 per trimester', MAIN, 'Diploma in KRCHN from an NCK-recognised institution, NCK registration and 2 years’ work experience.', 'nursing fundamentals'],
  ['Bachelor of Science in Health Records and Information Management', NUR, '8 semesters', '55,000 per semester or 45,000 per block', MAIN, 'KCSE mean C+ with C in English/Kiswahili and C- in Biology, Chemistry and Maths/Physics, or a relevant diploma plus 2 years’ experience.', 'health records management'],
  ['Bachelor of Science in Human Nutrition and Dietetics', NUR, '8 semesters', '55,000 per semester or 45,000 per block', MAIN, 'KCSE mean C+ with at least C in Biology, Chemistry, Physics/Maths/Geography and English/Kiswahili, or a diploma in food technology or nutrition and dietetics.', 'nutrition and dietetics'],
  ['Bachelor of Public Health (Pre-Service)', NUR, '8 semesters', '55,000 per semester or 45,000 per block', MAIN, 'KCSE mean C+ with C+ in English/Kiswahili, Biology, Chemistry and Maths/Physics.', 'public health'],
  ['Bachelor of Public Health (Upgrading)', NUR, '8 trimesters (January intake only)', '40,000 per block', MAIN, 'Ordinary diploma in Public Health or Environmental Health (credit), KCSE grade C, and PHOTC registration.', 'public health'],
  // Faculty of Science and Technology
  ['Bachelor of Science in Applied Computer Science', SCI, '8 semesters', '55,000 per semester or 40,000 per block', MAIN, 'KCSE mean C+ with C+ in Maths and Physics and C in English/Kiswahili, or a diploma in computer science.', 'computer science'],
  ['Bachelor of Science in Computer Science', SCI, '8 semesters', '55,000 per semester or 40,000 per block', MAIN, 'KCSE mean C+ with C+ in Maths and Physics and C in English/Kiswahili, or a diploma in computer science.', 'computer science'],
  ['Bachelor of Science in Business Information Technology', SCI, '8 semesters, full-time', '55,000 per semester', MAIN, 'KCSE mean C+ with C in Maths, or a diploma in IT or a business-related course.', 'business information technology'],
  ['Bachelor of Science (B.Sc.)', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Maths and C in Chemistry/Physics/Biology, or a diploma in applied sciences.', 'science'],
  ['Bachelor of Science in Actuarial Science', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Maths, or a diploma in statistics or computer studies.', 'actuarial science'],
  ['Bachelor of Science in Applied Statistics', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Maths and C in English/Kiswahili, or a diploma in statistics.', 'statistics'],
  ['Bachelor of Science in Mathematics', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Maths.', 'mathematics'],
  ['Bachelor of Science in Biomedical Science and Technology', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Biology and C+ in Maths/Physics.', 'biomedical science'],
  ['Bachelor of Science in Biochemistry', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Biology, C in Chemistry and C in Maths, or a diploma in biological sciences.', 'biochemistry'],
  ['Bachelor of Science in Chemistry', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Chemistry and C in Maths, or a diploma in physical sciences.', 'chemistry'],
  ['Bachelor of Science in Industrial Chemistry', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Chemistry, C in Maths and C in Physics.', 'industrial chemistry'],
  ['Bachelor of Science in Physics', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Physics and C in Maths, or a diploma in physical sciences.', 'physics'],
  ['Bachelor of Science in Mining Physics (Geophysics)', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Physics and Maths and C in Chemistry/Geography.', 'geophysics'],
  ['Bachelor of Science in Engineering Physics', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C in Physics, Chemistry and Maths. Bridging is possible for some applicants.', 'engineering physics'],
  ['Bachelor of Science in Biology', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Biology, C in Chemistry and C in Maths.', 'biology'],
  ['Bachelor of Science in Microbiology and Biotechnology', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Biology, C in Chemistry and C in Maths.', 'microbiology'],
  ['Bachelor of Science in Fisheries and Aquaculture', SCI, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology and C in Chemistry, or a diploma in biological sciences.', 'aquaculture fish farming'],
  // Faculty of Engineering
  ['Bachelor of Science in Electrical and Electronics Engineering', ENG, '10 semesters, full-time', '90,000 per semester', MAIN, 'KCSE mean C+ with C+ in Maths, Physics, Chemistry and English/Kiswahili, or a relevant diploma/HND.', 'electrical engineering'],
  ['Bachelor of Science in Aeronautical Engineering', ENG, '10 semesters, full-time', '90,000 per semester', MAIN, 'KCSE mean C+ with C+ in Maths, Physics, Chemistry and English/Kiswahili, or a relevant diploma/HND.', 'aeronautical engineering'],
  // Faculty of Business Studies
  ['Bachelor of Commerce (Accounting, Banking and Finance, Cooperative Management, Insurance and Risk Management, Human Resource Management, Marketing)', BUS, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or a business diploma, CPA/CPS II or HND. Credit transfer is possible.', 'commerce'],
  ['Bachelor of Science in Entrepreneurship and Technology Management', BUS, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or a diploma in a business-related area.', 'entrepreneurship'],
  ['Bachelor of Procurement and Logistics Management', BUS, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or a diploma in a business-related area.', 'procurement and supply chain'],
  ['Bachelor of Cooperatives Management', BUS, '8 semesters, full-time', '50,000 per semester or 34,000 per block', MAIN, 'KCSE mean C+ with C in Maths, or a business diploma, CPA/CPS II or HND.', 'cooperative management'],
  ['Bachelor of Science in Accounting and Finance', BUS, '8 semesters, full-time', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or a relevant diploma, CPA/CPS II or HND. Credit transfer is possible.', 'accounting'],
  ['Bachelor of Science in Finance and Statistics', BUS, '8 semesters, full-time', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or B in Economics/Commerce/Accounting/Business Studies.', 'finance'],
  ['Bachelor of Science in Human Resource Management', BUS, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths, or a business diploma, CPA/CPS II or HND.', 'human resource management'],
  // Faculty of Education and Resources Development
  ['Bachelor of Education (Primary)', EDU, '4 years, school-based or ODEL', '40,000 per block', ALL, 'KCSE mean C+ with C+ in two teaching subjects, or a diploma in education plus a P1 certificate.', 'primary school teaching'],
  ['Bachelor of Education (Arts)', EDU, '8 semesters, full-time, school-based or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C+ in two teaching subjects, or a diploma in education.', 'teaching methods'],
  ['Bachelor of Education (Science)', EDU, '8 semesters, full-time or school-based', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+ with C+ in two teaching subjects, or a diploma in education.', 'teaching science'],
  ['Bachelor of Education (Early Childhood Development)', EDU, '8 semesters, full-time, school-based or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C+ in two teaching subjects, or a diploma in education.', 'early childhood development'],
  // Faculty of Agriculture
  ['Bachelor of Agribusiness Management', AGR, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths and Biology and C+ in Agriculture/Business Studies, or a business diploma.', 'agribusiness'],
  ['Bachelor of Science in Agricultural Economics', AGR, '8 semesters, full-time', '55,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with C in Maths and Biology and C+ in Agriculture/Business Studies.', 'agricultural economics'],
  ['Bachelor of Science in Agricultural Education and Extension', AGR, '8 semesters, full-time', '55,000 per semester or 40,000 per block', MAIN, 'KCSE mean C+ with C+ in Biology and Agriculture, or an agriculture-related diploma.', 'agricultural extension'],
  ['Bachelor of Science in Animal Science', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Biology and C+ in Chemistry/Physics/Maths.', 'animal science livestock'],
  ['Bachelor of Science in Animal Products Technology', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Biology and C+ in Chemistry/Physics/Maths.', 'dairy and meat processing'],
  ['Bachelor of Science in Agriculture', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'agriculture farming'],
  ['Bachelor of Science in Horticulture', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'horticulture'],
  ['Bachelor of Science in Food Science and Technology', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology/Agriculture/Home Science, C in Chemistry, Maths/Physics and C+ in English/Kiswahili.', 'food science'],
  ['Bachelor of Science in Crop Protection and Management', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'crop protection'],
  ['Bachelor of Science in Landscaping and Ornamental Horticulture', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'landscaping gardening'],
  ['Bachelor of Science in Animal Health Production', AGR, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C+ in Biology and C+ in Chemistry/Physics/Maths, or a relevant diploma.', 'animal health'],
  // Faculty of Environmental Studies and Resources Development
  ['Bachelor of Science in Ecotourism', ENV, '8 semesters, full-time or part-time', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+, or a diploma in environment, tourism or hospitality.', 'ecotourism'],
  ['Bachelor of Tourism Management', ENV, '8 semesters, full-time or ODEL', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+ with C in English/Kiswahili, or a diploma in tourism and hotel management.', 'tourism management'],
  ['Bachelor of Hotel Management', ENV, '8 semesters, full-time', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+ with C in English/Kiswahili, or a diploma in tourism or hotel management.', 'hotel management hospitality'],
  ['Bachelor of Science in Environmental Science', ENV, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Biology/Agriculture and C+ in Chemistry/Geography.', 'environmental science'],
  ['Bachelor of Science in Natural Resources Management', ENV, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'natural resource management'],
  ['Bachelor of Science in Wildlife Enterprise and Management', ENV, '8 semesters, full-time or ODEL', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'wildlife management'],
  ['Bachelor of Science in Renewable Energy', ENV, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'renewable energy solar'],
  ['Bachelor of Science in Sustainable Forestry Enterprise and Management', ENV, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with C in Biology or C+ in Agriculture, C in Chemistry and Maths/Physics/Geography.', 'forestry'],
  ['Bachelor of Air Travel and Aviation Management', ENV, '8 semesters, full-time', '55,000 per semester or 40,000 per block', ALL, 'KCSE mean C+ with C in English/Kiswahili, or a diploma in air travel, tourism or aeronautical engineering.', 'aviation management'],
  // Faculty of Humanities and Social Sciences
  ['Bachelor of Science in Information Science', HUM, '8 semesters, full-time', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with at least C+ in English/Kiswahili, or a diploma in library and information studies.', 'information science'],
  ['Bachelor of Science in Community Development', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+, or a related diploma (a pass with 2 years’ experience may qualify).', 'community development'],
  ['Bachelor of Science in Economics and Statistics', HUM, '8 semesters, full-time', sciFee, MAIN, 'KCSE mean C+ with at least C+ in Maths and C in English/Kiswahili.', 'economics'],
  ['Bachelor of Arts in Economics and Sociology', HUM, '8 semesters, full-time', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with at least C+ in Maths and C in English/Kiswahili.', 'economics'],
  ['Bachelor of Psychology', HUM, '8 semesters, full-time', '50,000 per semester', MAIN, 'KCSE mean C+, or a diploma in guidance and counselling or social work.', 'psychology'],
  ['Bachelor of Arts (BA)', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+, or a diploma from a Senate-recognised institution.', 'arts and humanities'],
  ['Bachelor of Arts in Geography and Economics', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with C+ in Geography and Maths.', 'geography'],
  ['Bachelor of Arts in History and Economics', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with C+ in Maths and History/Geography, and C in English/Kiswahili.', 'history'],
  ['Bachelor of Arts in Mathematics and Economics', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with at least C+ in Maths.', 'mathematics and economics'],
  ['Bachelor of Arts in Criminology and Security Studies', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+, or a related diploma.', 'criminology'],
  ['Bachelor of Arts in Journalism and Mass Communication', HUM, '8 semesters, full-time', '50,000 per semester or 34,000 per block', MAIN, 'KCSE mean C+ with C+ in English/Kiswahili, or a diploma in journalism.', 'journalism'],
  ['Bachelor of Arts in Communication Studies', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', MAIN, 'KCSE mean C+ with C+ in English/Kiswahili, or a diploma in communication studies.', 'communication skills'],
  ['Bachelor of Arts in Linguistics and Literature', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with at least C+ in English/Kiswahili.', 'literature and linguistics'],
  ['Bachelor of Arts in Kiswahili and Geography', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with at least C+ in Kiswahili and Geography.', 'Kiswahili'],
  ['Bachelor of Arts in Philosophy', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+, or a diploma in philosophy.', 'philosophy'],
  ['Bachelor of Arts in Religious Studies', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with C+ in CRE/IRE/HRE and C in English/Kiswahili, or a related diploma.', 'religious studies'],
  ['Bachelor of Arts in Sociology', HUM, '8 semesters, full-time', '50,000 per semester', MAIN, 'KCSE mean C+, or a diploma in religious studies, theology, philosophy or ethics.', 'sociology'],
  ['Bachelor of Arts in Government and International Relations', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with at least C+ in English/Kiswahili, or a relevant diploma.', 'international relations'],
  ['Bachelor of Arts in Leadership and Public Administration', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+ with at least C+ in English/Kiswahili, or a relevant diploma.', 'public administration'],
  ['Bachelor of Arts in Project Planning and Management', HUM, '8 semesters, full-time or ODEL', '50,000 per semester or 34,000 per block', ALL, 'KCSE mean C+, or a related diploma (a pass with 2 years’ experience may qualify).', 'project management'],
  ['Bachelor of Arts in Kiswahili and Communication', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with at least C+ in Kiswahili, or a diploma in communication.', 'Kiswahili'],
  ['Bachelor of Arts in French and Sociology', HUM, '8 semesters, full-time', '50,000 per semester', ALL, 'KCSE mean C+ with at least C+ in French, or CEFR level B2.', 'French language'],
  // School of Law
  ['Bachelor of Laws (LLB)', LAW, '8 semesters, full-time', '74,300 per semester', MAIN, 'KCSE mean C+ with at least B in English/Kiswahili, or 3 principal passes, a degree, or a credit-pass law diploma with C+ in English/Kiswahili.', 'introduction to law'],
])

/* ------------------------------------------------------------------ DIPLOMAS ------------------------------------------------------------------ */
const bizDipEntry = 'KCSE mean C- (or KCE Division 3), or a certificate in business management.'
const bizDip = (name: string): Row => [name, BUS, '4 semesters, full-time or ODEL', '35,000 per semester or 24,000 per block', ALL, bizDipEntry]
const humDipEntry = 'KCSE mean C- or equivalent, or a certificate in a related course.'
const humDip = (name: string, dur = '4 semesters, full-time or ODEL'): Row => [name, HUM, dur, '35,000 per semester or 29,000 per block', ALL, humDipEntry]
const engDip = (name: string): Row => [name, ENG, '6 semesters, full-time', '42,000 per semester', MAIN, 'KCSE mean C- with C- in Maths, Physics, Chemistry/Physical Sciences and English/Kiswahili, or a related certificate.']
const agrDip = (name: string): Row => [name, AGR, '6 semesters, full-time or part-time', '35,000 per semester or 24,000 per block', MAIN, 'KCSE mean C- with C- in Biology (or C in Agriculture), C- in Chemistry and D+ in Maths/Physics/Geography, or a related certificate.']

const diplomas = build('Diploma', [
  bizDip('Diploma in Business Management'), bizDip('Diploma in Accounting'), bizDip('Diploma in Human Resource Management'),
  bizDip('Diploma in Procurement and Logistics Management'), bizDip('Diploma in Insurance and Risk Management'), bizDip('Diploma in Cooperative Management'),
  bizDip('Diploma in Entrepreneurship and Enterprise Management'), bizDip('Diploma in Sales and Marketing'),
  ['Diploma in Computer Science', SCI, '5 semesters, full-time', '35,000 per semester or 24,000 per block', 'Main and Embu', 'KCSE mean C- with C- in Maths, Physics (or Physical Sciences) and Kiswahili/English, or a certificate in computer science.'],
  engDip('Diploma in Architecture'), engDip('Diploma in Building Engineering'), engDip('Diploma in Electrical and Electronics Engineering'),
  engDip('Diploma in Mechanical Engineering'), engDip('Diploma in Civil Engineering'),
  ['Diploma in Agricultural Education and Extension', AGR, '3 years, full-time', '35,000 per semester or 24,000 per block', MAIN, 'KCSE mean C with C+ in Biology and Agriculture, or a certificate in agriculture.'],
  ['Diploma in Animal Health and Production (Pre-Service)', AGR, '4 semesters, full-time', '35,000 per semester', MAIN, 'KCSE mean C- with C- in Biology, Chemistry, Maths/Agriculture and English/Kiswahili, plus a credit-pass certificate in animal health and production.'],
  ['Diploma in Animal Health and Production (In-Service/Upgrading)', AGR, '4 semesters, full-time', '35,000 per semester', MAIN, 'KCSE mean C- plus a credit-pass certificate in animal health and production.'],
  ['Diploma in Meat Science and Technology', AGR, '6 semesters, full-time or part-time', '35,000 per semester or 24,000 per block', MAIN, 'KCSE mean C with C in Biology, C- in Chemistry, C in Maths/Agriculture and C- in English/Kiswahili, or a related certificate.'],
  agrDip('Diploma in Horticulture'), agrDip('Diploma in Agriculture and Rural Development'), agrDip('Diploma in Farm Resources Management'),
  ['Diploma in Tourism and Hotel Management', ENV, '4 semesters, full-time or part-time', '35,000 per semester or 24,000 per block', ALL, 'KCSE mean C- with C- in English/Kiswahili, or a certificate in hospitality, tourism or hotel management.'],
  ['Diploma in Wildlife Management', ENV, '4 semesters, full-time', '35,000 per semester or 24,000 per block', ALL, 'KCSE mean C- with C- in Maths/English/Kiswahili, or a relevant certificate.'],
  ['Diploma in Environmental Science and Natural Resources Management', ENV, '4 semesters, full-time', '35,000 per semester or 24,000 per block', ALL, 'KCSE mean C- with C- in Biology/Chemistry, or a relevant certificate.'],
  ['Diploma in Education (Primary Option)', EDU, '2 years, school-based or ODEL', '24,000 per block', ALL, 'KCSE mean C with C- in the cluster subjects and a P1 certificate.'],
  ['Diploma in Education (Early Childhood Development Education)', EDU, '3 years, full-time', '35,000 per semester or 24,000 per block', ALL, 'KCSE mean C, or a KNEC ECD certificate with C- in KCSE, or a PTE certificate.'],
  humDip('Diploma in Counselling Psychology', '3 years, full-time'), humDip('Diploma in Community Development'), humDip('Diploma in Criminology and Security Studies'),
  humDip('Diploma in Disaster Management'), humDip('Diploma in Project Planning and Management'), humDip('Diploma in Social Work'),
  humDip('Diploma in Leadership and Public Administration'), humDip('Diploma in Journalism and Mass Communication'),
  ['Diploma in Public Health', NUR, '4 semesters, full-time', '35,000 per semester or 29,000 per block', ALL, 'KCSE mean C- plus C (plain) in English/Kiswahili, Biology, Chemistry and Maths/Physics, or a certificate in public or environmental health with PHOTC registration.'],
  ['Diploma in Human Nutrition and Dietetics', NUR, '4 semesters, full-time', '35,000 per semester or 29,000 per block', ALL, 'KCSE mean C- with D+ in English/Kiswahili, Biology and Chemistry, and D in Maths/Physics/Home Science/Agriculture/General Science, or a KNDI-registered certificate.'],
])

/* ------------------------------------------------------------------ CERTIFICATES ------------------------------------------------------------------ */
const cert = (name: string, faculty: string, duration: string, fee: string, campus: string, entry: string, topic?: string): Row => [name, faculty, duration, fee, campus, entry, topic]
const bizCert = (n: string) => cert(n, BUS, '2 semesters, full-time or ODEL', '30,000 per semester', ALL, 'KCSE mean grade D and above.')
const humCert = (n: string) => cert(n, HUM, '2 to 3 semesters, full-time or ODEL', '30,000 per semester', ALL, 'KCSE mean D with D in English/Kiswahili, or D- with at least 2 years’ relevant work experience.')
const humShort = (n: string) => cert(n, HUM, '1 semester (4 months), full-time or ODEL', '15,000 per course', ALL, 'KCSE certificate.')

const certificates = build('Certificate', [
  bizCert('Certificate in Business Management'), bizCert('Certificate in Procurement and Logistics Management'), bizCert('Certificate in Entrepreneurship and Enterprise Management'),
  bizCert('Certificate in Sales and Marketing'), bizCert('Certificate in Cooperative Management'),
  cert('Certificate in Software Engineering', SCI, '2 semesters, full-time', '30,000 per semester', ALL, 'KCSE mean grade D and above.', 'software engineering'),
  cert('Certificate in Computer Science', SCI, '2 semesters, full-time', '30,000 per semester', ALL, 'KCSE mean grade D and above.', 'computer science'),
  cert('Certificate in Computer Literacy/Packages', SCI, '3 months (1 term), full-time or part-time', '15,000 per course', ALL, 'KCSE certificate.', 'computer packages Word Excel'),
  cert('Certificate in Animal Health and Production', AGR, '4 semesters, full-time', 'About 27,000 to 35,000 per semester (see the official list)', MAIN, 'KCSE mean C- with C- in Biology, or Division 3 with a credit in Biology, or a 1-year related certificate.'),
  cert('Certificate in Hospitality and Tourism Management', ENV, '2 semesters, full-time', '30,000 per semester', ALL, 'KCSE D+ with D+ in English/Kiswahili.'),
  cert('Certificate in Environmental Impact Assessment and Audit', ENV, '3 to 4 weeks, full-time', '25,000 (whole course)', ALL, 'KCSE certificate.', 'environmental impact assessment'),
  humCert('Certificate in Community Development'), humCert('Certificate in Criminology and Security Studies'), humCert('Certificate in Project Planning and Management'), humCert('Certificate in Social Work'),
  humShort('Certificate in Disaster Management'), humShort('Certificate in Leadership and Public Administration'), humShort('Certificate in Conflict Resolution and Management'),
  humShort('Certificate in National Cohesion, Values and Principles of Governance'), humShort('Certificate in HIV/AIDS Management'),
  cert('Certificate in Human Nutrition and Dietetics', NUR, '4 semesters, full-time', '30,000 per semester', MAIN, 'KCSE mean D with D in English/Kiswahili, Biology, Chemistry and D in Maths/Physics/Home Science/Agriculture/General Science.', 'nutrition'),
])

/* ------------------------------------------------------------------ SHORT COURSES & POSTGRAD DIPLOMAS ------------------------------------------------------------------ */
const shorts = build('Short course', [
  cert('KASNEB support: CPA, CPS, KISEB and ATD classes', BUS, 'Full-time or ODEL', 'From 9,000 to 15,000 depending on sections', ALL, 'Students registered with KASNEB (sections 1 to 6, KATC intermediate and final).', 'CPA accounting'),
  cert('Elementary Certificate in French Literacy', HUM, '3 months (2 terms), full-time', '18,000 per course', 'Main and Embu', 'Open to anyone who wants to learn French.', 'learn French'),
  cert('Subject Enhancement (any degree programme)', SCI, '1 semester (4 months), full-time', '50,000 for one semester or 3,000 per credit factor', MAIN, 'Admitted into a degree programme whose credit factors fall below the semester requirement.', 'study skills'),
])
const pgd = build('Postgraduate diploma', [
  cert('Postgraduate Diploma in Education', EDU, '1 year (3 blocks)', '55,500 (block 1), then 25,000 for each of blocks 2 and 3', ALL, 'A first degree with two teaching subjects passed with at least C+ in KCSE.', 'teaching methods'),
  cert('Post Training Diploma in Technical and Vocational Pedagogy', EDU, '1 year (3 blocks)', '55,500 (block 1), then 25,000 for each of blocks 2 and 3', MAIN, 'A diploma in an area of specialisation taught at TVET level.', 'teaching technical skills'),
])

/* ------------------------------------------------------------------ MASTER'S AND PhD (names; shared requirements) ------------------------------------------------------------------ */
const MASTERS = [
  'MA in Criminology and Security Studies', 'MA in English Language and Linguistics', 'MA in Geography', 'MA in History', 'MA in Kiswahili', 'MA in Literature', 'MA in Philosophy',
  'MA in Religious Studies', 'MA in Sociology', 'Master of Business Administration', 'MSc in Accounting', 'MSc in Co-operative Management', 'MEd in Arts Education',
  'MEd in Curriculum and Instruction', 'MEd in Educational Foundations', 'MEd in Educational Management', 'MEd in Educational Psychology', 'MEd in Early Childhood Development and Education',
  'MA in Counselling Psychology', 'MEd in Guidance and Counselling', 'MEd in Science Education', 'Master of Journalism and Mass Communication', 'MSc in Agribusiness Management',
  'MSc in Agricultural Economics', 'MSc in Agricultural Education', 'MSc in Agricultural Extension', 'MSc in Agronomy and Climate Change', 'MSc in Animal Breeding', 'MSc in Animal Nutrition',
  'MSc in Animal Science', 'MSc in Agro-Ecology', 'MSc in Applied Mathematics', 'MSc in Applied Statistics', 'MSc in Biochemistry', 'MSc in Botany (Genetics)', 'MSc in Botany (Plant Pathology)',
  'MSc in Chemistry', 'MSc in Health Records', 'MSc in Community Development', 'MSc in Computer Science', 'MSc in Crop Protection', 'MSc in Food Science and Technology', 'MSc in Dryland Agriculture',
  'MSc in Economics', 'MSc in Entrepreneurship and Enterprise Management', 'MSc in Environmental Science', 'MSc in Finance', 'MSc in Horticulture', 'MSc in Information Science',
  'MSc in Medical Parasitology', 'MSc in Medical Physics', 'MSc in Microbiology and Biotechnology', 'MSc in Natural Resources Management', 'MSc in Human Nutrition and Dietetics',
  'MSc in Operations Management', 'MSc in Physics', 'MSc in Plant Biotechnology', 'MSc in Plant Breeding', 'MSc in Procurement Management', 'MSc in Pure Mathematics', 'MSc in Soil Science',
  'MSc in Statistics', 'MSc in Wildlife Management', 'MSc in Zoology', 'Master of Hotel Management', 'Master of Tourism Management', 'Master of Public Health', 'MSc in Clinical Psychology', 'MSc in Nursing',
]
const PHDS = [
  'PhD in Accounting', 'PhD in Agribusiness Management', 'PhD in Agricultural Economics', 'PhD in Agricultural Education', 'PhD in Agricultural Extension', 'PhD in Agronomy', 'PhD in Applied Mathematics',
  'PhD in Applied Statistics', 'PhD in Biochemistry', 'PhD in Botany', 'PhD in Business and Management', 'PhD in Chemistry', 'PhD in Community Development', 'PhD in Counselling Psychology',
  'PhD in Criminology and Security', 'PhD in Crop Protection', 'PhD in Crop Science', 'PhD in Curriculum and Instruction', 'PhD in Dry Land Agriculture', 'PhD in Early Childhood Development and Education',
  'PhD in Educational Foundations', 'PhD in Educational Management', 'PhD in Educational Psychology', 'PhD in Environmental Science', 'PhD in Finance', 'PhD in Food Science', 'PhD in Geography',
  'PhD in History', 'PhD in Horticulture', 'PhD in Information Science', 'PhD in Communication and Media', 'PhD in Kiswahili', 'PhD in Linguistics', 'PhD in Literature', 'PhD in Medical Physics',
  'PhD in Microbiology and Biotechnology', 'PhD in Nursing', 'PhD in Philosophy', 'PhD in Physics', 'PhD in Plant Biotechnology', 'PhD in Plant Breeding', 'PhD in Pure Mathematics',
  'PhD in Religious Studies', 'PhD in Science Education', 'PhD in Sociology', 'PhD in Soil Science', 'PhD in Supply Chain Management', 'PhD in Tourism Management', 'PhD in Wildlife Management',
  'PhD in Zoology', 'PhD in Animal Science (Production, Nutrition or Breeding)', 'PhD in Medical Parasitology',
]
const GRAD = 'Graduate School'
const masters = build('Master’s', MASTERS.map((n): Row => [n, GRAD, '2 years full-time (4 semesters) or 4 years part-time', 'Arts-based: 71,000 (sem 1), 48,000 (sem 2), 40,000 per block. Science-based: 75,000, 55,000, 43,500 per block.', 'As directed by the Graduate School', 'A bachelor’s degree in a related field with at least second class honours (upper or lower), plus 2 years’ related work experience for lower second class.', n.replace(/^(MA|MSc|MEd|Master of) (in )?/i, '')]))
const phds = build('PhD', PHDS.map((n): Row => [n, GRAD, '3 years full-time (6 semesters) or 6 years part-time', 'Arts-based: about 119,250 in semester 1. Science-based: about 125,750 in semester 1. Later semesters are lower (see the official list).', 'As directed by the Graduate School', 'A master’s degree in a related field from a Senate-recognised institution.', n.replace(/^PhD (in )?/i, '')]))

export const CU_COURSES: CuCourse[] = [...certificates, ...diplomas, ...bachelors, ...pgd, ...shorts, ...masters, ...phds]

export const CU_LEVELS: ('All levels' | CuLevel)[] = ['All levels', 'Certificate', 'Diploma', 'Bachelor’s', 'Postgraduate diploma', 'Short course', 'Master’s', 'PhD']

export const CU_INTAKES = 'Full-time intakes are September, January and May. Part-time and holiday-based intakes are December, April and August.'

/** Finds Chuka programmes for a free-text phrase or a list of keywords (used to link a skill to a related programme). */
export function matchCourses(keys: string[], limit = 3): CuCourse[] {
  const ks = keys.map((k) => k.toLowerCase()).filter(Boolean)
  if (!ks.length) return []
  const score = (c: CuCourse) => {
    const n = `${c.name} ${c.topic}`.toLowerCase()
    return ks.reduce((s, k) => s + (n.includes(k) ? 1 : 0), 0) * 10 + (c.level === 'Diploma' || c.level === 'Certificate' ? 2 : c.level === 'Bachelor’s' ? 1 : 0)
  }
  return CU_COURSES.map((c) => ({ c, s: score(c) })).filter((x) => x.s >= 10).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.c)
}
