/** Built-in beginner roadmaps. The admin adds videos and classes to the matching category ("Learn VS Code", "Learn Computer"). */
export type PathStep = { title: string; text: string; search: string }
export type LearnPath = { id: 'vscode' | 'computer'; title: string; category: string; tagline: string; level: string; steps: PathStep[] }

export const LEARN_PATHS: LearnPath[] = [
  {
    id: 'vscode', title: 'Learn VS Code', category: 'Learn VS Code', level: 'Beginner',
    tagline: 'Set up the editor professionals use and learn to write, run and fix code in it.',
    steps: [
      { title: 'Install VS Code', text: 'Download it from the Software list, run the installer and open it. Tick “Add to PATH” if asked.', search: 'how to install VS Code on Windows' },
      { title: 'Know the screen', text: 'The sidebar, Explorer, editor tabs, the Terminal and the Command Palette (Ctrl+Shift+P).', search: 'VS Code interface tour for beginners' },
      { title: 'Open a folder and create files', text: 'Work inside one folder per project. Make your first index.html or hello.py.', search: 'VS Code open folder create file' },
      { title: 'Install extensions', text: 'Add Python, Prettier and Live Server. Extensions are what make VS Code powerful.', search: 'best VS Code extensions for beginners' },
      { title: 'Run your first program', text: 'Run code with the play button or the built-in Terminal and read what it prints.', search: 'run Python in VS Code terminal' },
      { title: 'Shortcuts that save hours', text: 'Multi-cursor, move line, comment line, find and replace, quick open (Ctrl+P).', search: 'VS Code shortcuts every beginner should know' },
      { title: 'Fix mistakes with the debugger', text: 'Use breakpoints and the Problems panel to find why code does not work.', search: 'VS Code debugging for beginners' },
      { title: 'Use Git and AI help', text: 'Commit your work from the Source Control tab and use an AI assistant to explain and fix code.', search: 'VS Code Git GitHub for beginners' },
    ],
  },
  {
    id: 'computer', title: 'Learn Computer', category: 'Learn Computer', level: 'Beginner',
    tagline: 'Computer basics from zero: files, typing, internet, email, Word and Google tools.',
    steps: [
      { title: 'Parts of a computer', text: 'Screen, keyboard, mouse, CPU, memory and storage: what each one does.', search: 'computer basics for beginners parts of a computer' },
      { title: 'Windows desktop and settings', text: 'Start menu, taskbar, opening and closing programs, Wi-Fi, volume and power.', search: 'Windows 11 basics for beginners' },
      { title: 'Files and folders', text: 'Create, rename, copy, move and find files. Use a flash disk safely.', search: 'file management for beginners Windows' },
      { title: 'Typing and keyboard shortcuts', text: 'Touch typing and shortcuts like Ctrl+C, Ctrl+V, Ctrl+Z and Alt+Tab.', search: 'touch typing for beginners' },
      { title: 'Internet, browser and email', text: 'Search well, download safely, create a Gmail account and send an email with an attachment.', search: 'how to use the internet and Gmail for beginners' },
      { title: 'Word, Docs and Sheets', text: 'Write and format a document, then make your first table or budget in Google Sheets.', search: 'Microsoft Word basics for beginners' },
      { title: 'Staying safe online', text: 'Strong passwords, spotting scams, backing up your files and avoiding viruses.', search: 'internet safety for beginners passwords scams' },
      { title: 'Printing, scanning and phone to PC', text: 'Print a document, scan a page and move photos between your phone and computer.', search: 'how to print and scan documents beginners' },
    ],
  },
]
export const pathById = (id: string) => LEARN_PATHS.find((p) => p.id === id)
