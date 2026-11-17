import type { Goal } from './chukaCourses'

/**
 * Curated starting points for the "Explore" page. Each idea links to free tutorials, free course providers, classes
 * on Chuka Skills and the matching Chuka University programmes. Nothing here promises income: "how" only explains
 * the ways people usually earn from the skill. Edit or add rows freely.
 */
export type SkillIdea = {
  id: string
  goal: Goal
  title: string
  blurb: string
  /** One of the Chuka Skills categories (see DEFAULT_CATEGORIES in the server script). */
  category: string
  /** Search phrase for tutorials, free courses and classes. */
  query: string
  level: 'Beginner' | 'Beginner to intermediate'
  /** What you need to begin. */
  needs: string
  /** Earning ideas only: how people usually earn from it. */
  how?: string
  /** Keywords used to find related Chuka University programmes. */
  chuka: string[]
}

export type GoalInfo = { id: Goal; label: string; tagline: string; color: string; bg: string }

export const GOALS: GoalInfo[] = [
  { id: 'earning', label: 'Earning', tagline: 'Skills you can turn into income, from your phone or hostel room.', color: '#8a5a00', bg: '#fff4d9' },
  { id: 'interest', label: 'Interest', tagline: 'Follow your curiosity and learn something new, just because.', color: '#1d4f91', bg: '#e6f0fd' },
  { id: 'health', label: 'Health', tagline: 'Look after your body and mind while you study.', color: '#146c43', bg: '#e3f6ec' },
  { id: 'hobby', label: 'Hobby', tagline: 'Creative and fun skills to enjoy in your free time.', color: '#8a2c64', bg: '#fbe8f3' },
]

export const SKILL_IDEAS: SkillIdea[] = [
  /* ---------- earning ---------- */
  { id: 'e-freelance-writing', goal: 'earning', title: 'Freelance writing and content', blurb: 'Write articles, product descriptions, CVs and social posts for clients.', category: 'Freelancing & online work', query: 'freelance writing for beginners', level: 'Beginner', needs: 'A phone or laptop and good English or Kiswahili', how: 'Per-article or per-word jobs, CV writing, ghost-writing, blog content for small businesses.', chuka: ['journalism', 'communication', 'literature'] },
  { id: 'e-video-editing', goal: 'earning', title: 'Video editing (CapCut, Premiere)', blurb: 'Cut reels, ads, wedding clips and YouTube videos.', category: 'Content & video', query: 'CapCut video editing tutorial', level: 'Beginner', needs: 'A smartphone is enough to start', how: 'Edit for businesses, churches, events, creators and short-form social media.', chuka: ['journalism', 'communication'] },
  { id: 'e-graphic-design', goal: 'earning', title: 'Graphic design (Canva, Photoshop)', blurb: 'Posters, logos, flyers, social media graphics and branding.', category: 'Design & creative', query: 'graphic design for beginners Canva', level: 'Beginner', needs: 'Phone or laptop. Canva is free to start', how: 'Logos, posters, event flyers, social media packs and printing partnerships.', chuka: ['design', 'communication'] },
  { id: 'e-social-media', goal: 'earning', title: 'Social media management', blurb: 'Run Instagram, TikTok and WhatsApp business pages for local shops.', category: 'Social media & marketing', query: 'social media marketing for small business', level: 'Beginner', needs: 'A phone and consistency', how: 'Monthly packages for shops, salons, restaurants and hostels around campus.', chuka: ['marketing', 'sales', 'communication'] },
  { id: 'e-web-dev', goal: 'earning', title: 'Web and app development', blurb: 'Build websites and small apps. Start with HTML, CSS and JavaScript.', category: 'Tech & coding', query: 'web development full course for beginners', level: 'Beginner', needs: 'A laptop and steady power and data', how: 'Websites for businesses, school projects, freelance platforms and employment.', chuka: ['computer science', 'software', 'information'] },
  { id: 'e-excel-data', goal: 'earning', title: 'Excel and data skills', blurb: 'Spreadsheets, data entry, cleaning and simple dashboards.', category: 'Data & Excel', query: 'Excel for beginners', level: 'Beginner', needs: 'A laptop with Excel or free Google Sheets', how: 'Data entry, bookkeeping help, reports for small businesses, virtual assistant work.', chuka: ['statistics', 'accounting', 'computer', 'information'] },
  { id: 'e-ai-tools', goal: 'earning', title: 'AI tools and prompt skills', blurb: 'Use AI to write, design, research and automate boring tasks faster.', category: 'AI tools', query: 'how to use AI tools for work', level: 'Beginner', needs: 'A phone or laptop and internet', how: 'Speed up freelance work, offer AI-assisted content or research, help businesses adopt tools.', chuka: ['computer science', 'information', 'statistics'] },
  { id: 'e-phone-repair', goal: 'earning', title: 'Phone repair and electronics', blurb: 'Fix screens, batteries, charging ports and software problems.', category: 'Phone repair & electronics', query: 'phone repair for beginners', level: 'Beginner', needs: 'Basic tools and a learning partner', how: 'Repairs for fellow students, small repair counter, selling accessories.', chuka: ['electrical', 'electronics', 'physics'] },
  { id: 'e-hair-beauty', goal: 'earning', title: 'Hair, barbering and beauty', blurb: 'Braiding, barbering, makeup, nails and skin care.', category: 'Hair & beauty', query: 'barbering and braiding tutorial', level: 'Beginner', needs: 'Basic kit and practice on friends', how: 'Hostel-based appointments, events, weddings, a shared salon chair.', chuka: ['entrepreneurship', 'business'] },
  { id: 'e-baking', goal: 'earning', title: 'Baking and catering', blurb: 'Cakes, mandazi, snacks and event catering.', category: 'Cooking & baking', query: 'baking for beginners business', level: 'Beginner', needs: 'Basic equipment and a small starting budget', how: 'Orders for birthdays, office meetings and campus events, bulk snacks.', chuka: ['hotel', 'food', 'hospitality'] },
  { id: 'e-tailoring', goal: 'earning', title: 'Tailoring and fashion', blurb: 'Sew, alter and design clothes. Mend, resize and make custom pieces.', category: 'Fashion & tailoring', query: 'tailoring for beginners', level: 'Beginner', needs: 'A sewing machine or a place to learn on one', how: 'Alterations, uniforms, custom outfits, resale of designs.', chuka: ['entrepreneurship', 'business'] },
  { id: 'e-photography', goal: 'earning', title: 'Photography and film', blurb: 'Portraits, graduation shoots, events and product photos.', category: 'Photography & film', query: 'phone photography for beginners', level: 'Beginner', needs: 'A phone camera and good light', how: 'Graduation and event shoots, product photos for sellers, passport photos.', chuka: ['journalism', 'communication', 'tourism'] },
  { id: 'e-farming', goal: 'earning', title: 'Farming and agribusiness', blurb: 'Poultry, horticulture, dairy and kitchen gardens for income.', category: 'Farming & agribusiness', query: 'poultry farming for beginners', level: 'Beginner', needs: 'Land or space, small starting capital', how: 'Selling eggs, vegetables and milk, value addition, supplying hostels and hotels.', chuka: ['agribusiness', 'horticulture', 'animal', 'agriculture'] },
  { id: 'e-tutoring', goal: 'earning', title: 'Tutoring and mentoring', blurb: 'Teach what you are strong at: KCSE revision, maths, languages, coding.', category: 'Study skills', query: 'how to become an online tutor', level: 'Beginner', needs: 'Strong grades in a subject and patience', how: 'Paid revision classes, online tutoring, small study groups.', chuka: ['education', 'teaching'] },
  { id: 'e-ecommerce', goal: 'earning', title: 'Online selling and e-commerce', blurb: 'Sell products through WhatsApp, Instagram and online marketplaces.', category: 'Business & money', query: 'start online business Kenya', level: 'Beginner', needs: 'A phone and a small starting stock', how: 'Reselling, delivering for sellers, running a small online shop.', chuka: ['marketing', 'procurement', 'entrepreneurship', 'commerce'] },

  /* ---------- interest ---------- */
  { id: 'i-coding', goal: 'interest', title: 'Learn to code', blurb: 'Python is a friendly first language and useful in almost every field.', category: 'Tech & coding', query: 'Python programming for beginners', level: 'Beginner', needs: 'A phone or laptop', chuka: ['computer science', 'software'] },
  { id: 'i-ai', goal: 'interest', title: 'How AI works', blurb: 'Understand AI tools, their limits and how to use them wisely.', category: 'AI tools', query: 'introduction to artificial intelligence', level: 'Beginner', needs: 'Curiosity', chuka: ['computer science', 'statistics', 'information'] },
  { id: 'i-languages', goal: 'interest', title: 'Languages', blurb: 'French, Kiswahili, English, German or Mandarin. Open doors and scholarships.', category: 'Languages', query: 'learn French for beginners', level: 'Beginner', needs: 'Ten minutes a day', chuka: ['french', 'kiswahili', 'linguistics'] },
  { id: 'i-public-speaking', goal: 'interest', title: 'Public speaking and debate', blurb: 'Speak with confidence in class, interviews and leadership.', category: 'Study skills', query: 'public speaking tips', level: 'Beginner', needs: 'A friend to practise with', chuka: ['communication', 'leadership', 'journalism'] },
  { id: 'i-personal-finance', goal: 'interest', title: 'Personal finance and investing', blurb: 'Budgeting, saving, SACCOs, money market funds and avoiding scams.', category: 'Business & money', query: 'personal finance basics', level: 'Beginner', needs: 'Nothing but curiosity', chuka: ['finance', 'accounting', 'economics'] },
  { id: 'i-study-skills', goal: 'interest', title: 'Study and memory skills', blurb: 'Take notes, revise smarter and beat procrastination.', category: 'Study skills', query: 'how to study effectively', level: 'Beginner', needs: 'Your current notes', chuka: ['education', 'psychology'] },
  { id: 'i-science', goal: 'interest', title: 'Science and maths for fun', blurb: 'Physics, chemistry, biology and maths explained in plain language.', category: 'Other', query: 'science explained for beginners', level: 'Beginner', needs: 'Curiosity', chuka: ['physics', 'chemistry', 'biology', 'mathematics'] },
  { id: 'i-history-philosophy', goal: 'interest', title: 'History, philosophy and ideas', blurb: 'African history, ethics, logic and how to think clearly.', category: 'Other', query: 'introduction to philosophy', level: 'Beginner', needs: 'A good book or video list', chuka: ['history', 'philosophy', 'sociology'] },
  { id: 'i-leadership', goal: 'interest', title: 'Leadership and community work', blurb: 'Lead a club, run a project and organise people to get things done.', category: 'Business & money', query: 'leadership skills for students', level: 'Beginner', needs: 'A cause you care about', chuka: ['leadership', 'project', 'community'] },
  { id: 'i-environment', goal: 'interest', title: 'Environment and climate', blurb: 'Climate change, conservation, tree growing and clean energy.', category: 'Other', query: 'climate change explained', level: 'Beginner', needs: 'Curiosity', chuka: ['environmental', 'renewable', 'wildlife', 'forestry'] },

  /* ---------- health ---------- */
  { id: 'h-first-aid', goal: 'health', title: 'First aid and CPR', blurb: 'Handle cuts, burns, choking and emergencies until help arrives.', category: 'Health & first aid', query: 'first aid and CPR basics', level: 'Beginner', needs: 'A friend to practise with. A local first aid course is best for certification', chuka: ['nursing', 'public health'] },
  { id: 'h-nutrition', goal: 'health', title: 'Nutrition basics', blurb: 'Eat well on a student budget: balanced meals, protein and hydration.', category: 'Health & first aid', query: 'nutrition basics for students', level: 'Beginner', needs: 'Nothing special', chuka: ['nutrition', 'dietetics', 'food'] },
  { id: 'h-mental-wellbeing', goal: 'health', title: 'Mental wellbeing and stress', blurb: 'Manage stress, anxiety and exam pressure. Know when to ask for help.', category: 'Mental wellbeing', query: 'managing stress for students', level: 'Beginner', needs: 'A few quiet minutes a day', chuka: ['psychology', 'counselling', 'social work'] },
  { id: 'h-fitness', goal: 'health', title: 'Home workouts and fitness', blurb: 'Simple workouts you can do in a hostel room with no equipment.', category: 'Fitness & wellness', query: 'beginner home workout no equipment', level: 'Beginner', needs: 'Floor space and 20 minutes', chuka: ['health'] },
  { id: 'h-hygiene', goal: 'health', title: 'Hygiene and public health', blurb: 'Clean water, food safety, hostel hygiene and preventing common illnesses.', category: 'Health & first aid', query: 'hygiene and public health basics', level: 'Beginner', needs: 'Nothing special', chuka: ['public health', 'environmental health'] },
  { id: 'h-reproductive-health', goal: 'health', title: 'Sexual and reproductive health', blurb: 'Reliable information on relationships, safe choices and where to get help.', category: 'Health & first aid', query: 'sexual and reproductive health education', level: 'Beginner', needs: 'Trusted sources (clinics, Ministry of Health, WHO)', chuka: ['hiv', 'nursing', 'public health'] },
  { id: 'h-sleep', goal: 'health', title: 'Sleep and study balance', blurb: 'Build a sleep and revision routine that actually works.', category: 'Mental wellbeing', query: 'sleep hygiene tips', level: 'Beginner', needs: 'A regular bedtime', chuka: ['psychology'] },
  { id: 'h-cooking-healthy', goal: 'health', title: 'Healthy cooking on a budget', blurb: 'Cheap, quick meals from local food: beans, greens, ugali and eggs.', category: 'Cooking & baking', query: 'healthy budget meals', level: 'Beginner', needs: 'A jiko or cooker and basic pots', chuka: ['nutrition', 'food', 'hotel'] },
  { id: 'h-substance-awareness', goal: 'health', title: 'Alcohol and drug awareness', blurb: 'Understand the risks, spot warning signs and find support early.', category: 'Mental wellbeing', query: 'drug and alcohol awareness for young people', level: 'Beginner', needs: 'An open mind and a trusted person to talk to', chuka: ['counselling', 'psychology', 'social work'] },

  /* ---------- hobby ---------- */
  { id: 'o-guitar', goal: 'hobby', title: 'Guitar, piano and keyboard', blurb: 'Pick up an instrument and play your first songs within weeks.', category: 'Music & arts', query: 'guitar for beginners', level: 'Beginner', needs: 'An instrument (or a friend who has one)', chuka: ['music'] },
  { id: 'o-singing-production', goal: 'hobby', title: 'Singing and music production', blurb: 'Sing, record and make beats with free software.', category: 'Music & arts', query: 'music production for beginners', level: 'Beginner', needs: 'A phone or laptop and headphones', chuka: ['music', 'communication'] },
  { id: 'o-drawing', goal: 'hobby', title: 'Drawing and painting', blurb: 'Sketching, portraits, digital art and calm creative time.', category: 'Design & creative', query: 'drawing for beginners', level: 'Beginner', needs: 'Paper and a pencil', chuka: ['design'] },
  { id: 'o-photography', goal: 'hobby', title: 'Photography for fun', blurb: 'Capture campus, nature and friends with better light and framing.', category: 'Photography & film', query: 'photography composition tips', level: 'Beginner', needs: 'A phone camera', chuka: ['tourism', 'ecotourism'] },
  { id: 'o-cooking', goal: 'hobby', title: 'Cooking and baking', blurb: 'Try new recipes. Browse the cooking corner on the Learn page.', category: 'Cooking & baking', query: 'easy recipes for beginners', level: 'Beginner', needs: 'Basic ingredients and a pot', chuka: ['food', 'hotel', 'nutrition'] },
  { id: 'o-chess-games', goal: 'hobby', title: 'Chess and strategy games', blurb: 'Learn openings, tactics and endgames, then join campus tournaments.', category: 'Sports & games', query: 'chess for beginners', level: 'Beginner', needs: 'A phone app or a board', chuka: ['mathematics'] },
  { id: 'o-gardening', goal: 'hobby', title: 'Gardening and plants', blurb: 'Grow vegetables, herbs and flowers, even in sacks or containers.', category: 'Farming & agribusiness', query: 'kitchen garden for beginners', level: 'Beginner', needs: 'A sack, soil and seeds', chuka: ['horticulture', 'landscaping', 'agriculture'] },
  { id: 'o-writing', goal: 'hobby', title: 'Creative writing and poetry', blurb: 'Stories, spoken word and blogging. Find your voice.', category: 'Music & arts', query: 'creative writing tips', level: 'Beginner', needs: 'A notebook or notes app', chuka: ['literature', 'linguistics', 'kiswahili'] },
  { id: 'o-dance', goal: 'hobby', title: 'Dance and fitness for fun', blurb: 'Afrobeat, amapiano and traditional dances you can learn from video.', category: 'Music & arts', query: 'dance tutorial for beginners', level: 'Beginner', needs: 'Floor space and music', chuka: ['music'] },
  { id: 'o-football', goal: 'hobby', title: 'Football skills and coaching', blurb: 'Dribbling, passing and fitness drills. See the CPL and eFootball hubs.', category: 'Sports & games', query: 'football skills for beginners', level: 'Beginner', needs: 'A ball and some space', chuka: ['health'] },
  { id: 'o-crafts', goal: 'hobby', title: 'Crafts: crochet, beading, DIY', blurb: 'Make gifts and decorations. Many crafts can also earn a little on the side.', category: 'Fashion & tailoring', query: 'crochet for beginners', level: 'Beginner', needs: 'Thread or yarn and a hook', chuka: ['design'] },
]

export const ideasFor = (goal: Goal) => SKILL_IDEAS.filter((s) => s.goal === goal)

export const ytLink = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(/tutorial|course|lesson/i.test(q) ? q : `${q} tutorial`)}`
