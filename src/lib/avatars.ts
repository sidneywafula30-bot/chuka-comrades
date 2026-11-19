/* Random-looking cartoon avatars for Hookup profiles. No real photos are used.
 * The same profile code always gets the same avatar (picked from a hash), so a card looks
 * identical on the page and in the WhatsApp share picture. Returned as an SVG data URI,
 * so there are no image files to upload or host. */

const SKINS = ['#f6d3b3', '#efbf94', '#d9a073', '#bf8456', '#8d5a36', '#5e3a22']
const SKIN_SHADE = ['#e8bd98', '#dfa87c', '#c58b5f', '#a86f45', '#774825', '#4a2c18']
const HAIRS = ['#1b1210', '#2b1a12', '#4a2a17', '#6b3f1d', '#a8742f', '#2a2a33']

/** Background gradients per group: female = pinks/purples, male = blues/teals, other = greens/golds. */
const BG: Record<'female' | 'male' | 'other', [string, string][]> = {
  female: [['#ff8ab3', '#a62bd6'], ['#ff5a9d', '#ff9a5a'], ['#c77dff', '#ff6fb1'], ['#ff7aa8', '#7b5cff']],
  male: [['#4da3ff', '#2b4bd6'], ['#2dd4bf', '#3b82f6'], ['#6d7bff', '#1b2f8a'], ['#38bdf8', '#0f766e']],
  other: [['#2dd4bf', '#ffb100'], ['#34d399', '#6d4aff'], ['#ffd166', '#06b6a4'], ['#a3e635', '#0ea5a4']],
}
const SHIRTS = ['#ffffff', '#1f2937', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899']

type Group = 'female' | 'male' | 'other'
const group = (g: string): Group => (g === 'Female' ? 'female' : g === 'Male' ? 'male' : 'other')

function hash(s: string): number {
  let n = 2166136261
  for (let i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619) >>> 0 }
  return n >>> 0
}

/** Hair drawn BEHIND the head (long hair, afro, buns...). */
function hairBack(style: string, c: string): string {
  switch (style) {
    case 'long': return `<path d="M52 96c-4-46 20-66 48-66s52 20 48 66l6 64H46z" fill="${c}"/>`
    case 'afro': return `<circle cx="100" cy="78" r="56" fill="${c}"/>`
    case 'curly': return `<g fill="${c}"><circle cx="58" cy="74" r="22"/><circle cx="142" cy="74" r="22"/><circle cx="76" cy="46" r="24"/><circle cx="124" cy="46" r="24"/><circle cx="100" cy="38" r="24"/></g>`
    case 'braids': return `<g fill="${c}"><rect x="50" y="76" width="16" height="84" rx="8"/><rect x="134" y="76" width="16" height="84" rx="8"/></g>`
    case 'bun': return `<circle cx="100" cy="30" r="20" fill="${c}"/>`
    default: return ''
  }
}
/** Hair drawn IN FRONT (top of head / fringe / caps). */
function hairFront(style: string, c: string, accent: string): string {
  switch (style) {
    case 'long': case 'bun': case 'braids': return `<path d="M58 88c0-30 16-46 42-46s42 16 42 46c-14-14-30-20-42-20s-28 6-42 20z" fill="${c}"/>`
    case 'afro': case 'curly': return `<path d="M60 84c2-26 18-38 40-38s38 12 40 38c-12-10-26-14-40-14s-28 4-40 14z" fill="${c}"/>`
    case 'short': return `<path d="M58 84c0-28 16-42 42-42s42 14 42 42c-10-12-24-18-42-18s-32 6-42 18z" fill="${c}"/>`
    case 'flat': return `<path d="M58 86c-2-28 10-44 42-44s44 16 42 44c-8-14-22-20-42-20s-34 6-42 20z" fill="${c}"/><rect x="66" y="40" width="68" height="18" rx="9" fill="${c}"/>`
    case 'wavy': return `<path d="M56 92c-2-34 18-52 46-52 24 0 42 14 42 40-8-10-18-16-30-18-14 8-34 14-58 30z" fill="${c}"/>`
    case 'cap': return `<path d="M56 78c0-26 18-40 44-40s44 14 44 40z" fill="${accent}"/><path d="M52 80h96c0 8-10 10-18 10H70c-8 0-18-2-18-10z" fill="${accent}" opacity=".85"/>`
    case 'beanie': return `<path d="M58 80c0-30 16-46 42-46s42 16 42 46z" fill="${accent}"/><rect x="54" y="74" width="92" height="14" rx="7" fill="${accent}" opacity=".8"/>`
    case 'bald': return ''
    default: return ''
  }
}

const STYLES: Record<Group, string[]> = {
  female: ['long', 'bun', 'afro', 'curly', 'braids', 'long', 'bun', 'curly'],
  male: ['short', 'flat', 'afro', 'cap', 'short', 'bald', 'flat', 'curly'],
  other: ['wavy', 'beanie', 'short', 'bun', 'curly', 'cap', 'wavy', 'afro'],
}

export function avatarSvg(gender: string, code: string): string {
  const grp = group(gender)
  const n = hash(`${grp}:${code}`)
  const skin = n % 6
  const style = STYLES[grp][(n >>> 3) % 8]
  const hair = HAIRS[(n >>> 7) % 6]
  const [b1, b2] = BG[grp][(n >>> 11) % 4]
  const shirt = SHIRTS[(n >>> 14) % 8]
  const accent = SHIRTS[(n >>> 17) % 8 === (n >>> 14) % 8 ? 1 : (n >>> 17) % 8]
  const beard = grp === 'male' && ((n >>> 20) % 3 === 0 || style === 'bald')
  const lashes = grp === 'female'
  const blush = grp !== 'male'
  const glasses = (n >>> 22) % 5 === 0
  const sk = SKINS[skin], sh = SKIN_SHADE[skin]
  const eye = '#1b1210'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
<rect width="200" height="200" fill="url(#g)"/>
<circle cx="164" cy="34" r="26" fill="#fff" opacity=".12"/><circle cx="30" cy="150" r="34" fill="#fff" opacity=".1"/>
${hairBack(style, hair)}
<path d="M34 200c0-34 28-52 66-52s66 18 66 52z" fill="${shirt}"/>
<path d="M82 148h36v-20H82z" fill="${sh}"/>
<ellipse cx="100" cy="98" rx="42" ry="48" fill="${sk}"/>
<ellipse cx="58" cy="102" rx="7" ry="10" fill="${sk}"/><ellipse cx="142" cy="102" rx="7" ry="10" fill="${sk}"/>
${hairFront(style, hair, accent)}
${beard ? `<path d="M60 108c2 30 18 44 40 44s38-14 40-44c-8 10-22 14-40 14s-32-4-40-14z" fill="${hair}"/><path d="M88 122c8 4 16 4 24 0" stroke="${sk}" stroke-width="0" fill="none"/>` : ''}
<g fill="${eye}"><ellipse cx="84" cy="98" rx="4.4" ry="5.2"/><ellipse cx="116" cy="98" rx="4.4" ry="5.2"/></g>
<g fill="#fff"><circle cx="85.6" cy="96" r="1.5"/><circle cx="117.6" cy="96" r="1.5"/></g>
${lashes ? `<g stroke="${eye}" stroke-width="2.2" stroke-linecap="round"><path d="M78 92l-4-3M84 90l-1-4M90 92l3-3"/><path d="M110 92l-3-3M116 90l1-4M122 92l4-3"/></g>` : `<g stroke="${hair}" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M76 87q8-5 16 0"/><path d="M108 87q8-5 16 0"/></g>`}
${blush ? `<g fill="#ff6b8a" opacity=".28"><ellipse cx="74" cy="112" rx="8" ry="5"/><ellipse cx="126" cy="112" rx="8" ry="5"/></g>` : ''}
<path d="M95 108q5 5 10 0" stroke="${sh}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M86 124q14 ${beard ? 8 : 12} 28 0" stroke="${beard ? '#fff' : '#b3445a'}" stroke-width="${beard ? 3 : 3.6}" fill="none" stroke-linecap="round"/>
${glasses ? `<g fill="none" stroke="#111" stroke-width="3"><circle cx="84" cy="98" r="11"/><circle cx="116" cy="98" r="11"/><path d="M95 98h10"/></g>` : ''}
</svg>`
  return svg
}

/** `data:` URI for use in <img src> and in canvas drawImage. */
export function avatarUri(gender: string, code: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(gender, code))}`
}

/** The gradient colours used for a gender's cards and share picture. */
export const GENDER_COLORS: Record<Group, [string, string]> = {
  female: ['#ff5a9d', '#a62bd6'],
  male: ['#3b82f6', '#6d4aff'],
  other: ['#2dd4bf', '#ff9a1f'],
}
export const genderColors = (g: string): [string, string] => GENDER_COLORS[group(g)]
