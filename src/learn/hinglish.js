// Hinglish (Hindi in Roman letters, the way many students type) for the first seven lessons.
// The newer lessons carry their Hinglish inline. Labels a student must find on screen stay in English.
export const HINGLISH = {
  'junior-story': {
    title: 'Character se kahani bulwaiye',
    summary: 'Character ko chalaiye, bulwaiye, aur ek baar mein ek hi cheez badliye.',
    needs: 'Camera, account ya board ki zaroorat nahi.',
    steps: {
      open: {title: 'Apna stage dekhiye', body: 'Junior Blocks kholiye. Play story se kahani chalaiye, phir Stop story dabaiye. Naya example chahiye to pehle Save project kariye, phir neeche se starter download karke Open story se kholiye.', check: 'Main kahani chala aur rok sakta/sakti hoon.'},
      change: {title: 'Character ko apni awaaz dijiye', body: 'Script mein Say block dhoondhiye, ya Looks → Say se jodiye. Words to say mein apna greeting likhiye. Play story dabaiye aur speech bubble dekhiye.', check: 'Mera character mera greeting bolta hai.', hint: 'Blocks left se right chalte hain. Chhote arrow buttons se block aage ya peeche kariye.'},
      experiment: {title: 'Pehle andaaza, phir try', body: 'Motion → Go right chuniye. Number 1 se 3 kariye. Andaaza lagaiye character kitna chalega, phir play kariye. Ek square 20 pixels ka hai. Compare karne se pehle Reset starting positions dabaiye.', check: 'Maine number badla aur result compare kiya.'},
      save: {title: 'Kahani sambhaliye', body: 'Sirf Junior kahani ke liye Save story, ya poore DUETBlox workspace ke liye Save project kariye. Downloaded file aisi jagah rakhiye jahan baad mein mil jaaye.', check: 'Maine apne computer par ek copy save ki.'}
    }
  },
  'scratch-animation': {
    title: 'Apna pehla block sequence banaiye',
    summary: 'Ek event, ek movement aur ek message jodiye.',
    needs: 'Camera, account ya board ki zaroorat nahi.',
    steps: {
      event: {title: 'Kab shuru ho, ye chuniye', body: 'Blocks kholiye aur ek character chuniye. Code mein Events → when green flag clicked ko coding area ki khaali jagah mein kheenchiye. Purani scripts rehne dijiye; backup chahiye to pehle Save project kariye.', check: 'Meri script mein green flag wala start block hai.'},
      sequence: {title: 'Do kaam saath jodiye', body: 'Start block ke neeche Motion → move 10 steps jodiye. Uske neeche Looks → say Hello! for 2 seconds lagaiye. Stage ke upar green flag dabaiye.', check: 'Mera character pehle chalta hai, phir bolta hai.', hint: 'Baaki green flag scripts bhi chalti hain. Result alag lage to har character ki baaki scripts dekhiye.'},
      loop: {title: 'Ek kaam repeat kariye', body: 'Move block ko Control → repeat 10 ke andar rakhiye. Repeat ka number 3 kariye. Kul kitna chalega, andaaza lagaiye, phir script chalaiye. Stop se saari chalti scripts ruk jaati hain.', check: 'Main bata sakta/sakti hoon ki character 30 steps kyun chala.'},
      save: {title: 'Apni creation ko naam dijiye', body: 'Upar Project name badliye, phir Save project kariye. Aapki .duet file mein Scratch program aur baaki workspace dono aate hain.', check: 'Maine project ko naam dekar save kiya.'}
    }
  },
  'image-detective': {
    title: 'Shape pehchanna sikhaiye',
    summary: 'Train kariye, phir aisi tasveeron se check kariye jo model ne kabhi nahi dekhi.',
    needs: 'Image learning chuniye. Pehle image model ko offline use ke liye taiyaar kariye; camera zaroori nahi.',
    steps: {
      examples: {title: 'Do classes se shuru kariye', body: 'ML Studio → Image learning kholiye. Purane examples badalne se pehle Save project kariye. Try an example se Orange circle aur Blue square ki tasveerein aati hain. Isse abhi ka image training dataset badal jaata hai.', check: 'Mujhe dono shape classes ke examples dikh rahe hain.'},
      train: {title: 'Model ko train kariye', body: 'Train model chuniye aur training poori hone dijiye. Ooncha training score sirf jaane-pehchane examples par model ka haal batata hai.', check: 'Mere image model ki training poori hui.'},
      test: {title: 'Bilkul nayi tasveer try kariye', body: 'Test image mein alag se banaya naya orange circle ya blue square dijiye. Training wali thumbnail dobara mat lijiye. Tasveer mein asal mein kya hai, usse label aur score compare kariye.', check: 'Maine aisi tasveer check ki jo training mein nahi thi.', hint: 'Model shape ki jagah rang ya background seekh sakta hai. Wahi shape doosre rang mein try kariye aur dekhiye kya hota hai.'},
      evaluate: {title: 'Galtiyan dhoondhiye', body: 'Check with new examples mein sahi class ke neeche alag evaluation tasveerein jodiye. Evaluate new examples chuniye. Galat labels aur Unknown dekhiye, phir examples aur model rakhne ke liye Save project kariye.', check: 'Maine naye examples check kiye aur ek kami bata sakta/sakti hoon.'}
    }
  },
  'text-greetings': {
    title: 'Hindi / English greeting helper banaiye',
    summary: 'Words ke patterns seekhiye aur samjhiye ki Unknown kab aata hai.',
    needs: 'Text learning isi device par chalta hai; model download ya microphone ki zaroorat nahi.',
    steps: {
      examples: {title: 'Do kaamon ke liye sentences chuniye', body: 'ML Studio → Text learning kholiye. Examples badalne se pehle Save project kariye, phir Greeting aur Goodbye ke liye Try an example chuniye. Ya har class mein kam se kam 3 alag sentences likhkar Add examples kariye.', check: 'Har class mein alag-alag example sentences hain.'},
      train: {title: 'Train kariye aur report dekhiye', body: 'Train text model chuniye. Har class mein kam se kam 5 unique examples hon to Separate holdout check bhi chalta hai. Dekhiye alag rakhe kaun se sentences sahi aaye aur kaun se galat.', check: 'Maine text model train karke uski report dekhi.'},
      unknown: {title: 'Greeting aur anjaan words check kariye', body: 'A new sentence mein “नमस्ते दोस्त” daalkar Classify text chuniye. Result par asar daalne wale words dekhiye. Phir examples se bahar ke words jaise “quantum zebras nebula” try kariye. Koi seekha hua word na ho to Unknown aana chahiye.', check: 'Maine jaana-pehchana greeting aur anjaan words compare kiye.', hint: 'Ye model words ginta hai. Ye language translate nahi karta, aur words ka order, mazaak ya matlab nahi samajhta.'},
      blocks: {title: 'Model ko program mein use kariye', body: 'Use in Blocks chuniye. classify text ko start event se jodiye, phir text label ko say block mein rakhiye. Program sirf accept hue result par kaam kare, iske liye text prediction accepted? use kariye. Save project kariye.', check: 'Maine block program mein text prediction use kiya.'}
    }
  },
  'arduino-led': {
    title: 'Arduino Uno ki LED chalaiye',
    summary: 'Board check kariye, connect kariye aur HIGH / LOW try kariye.',
    needs: 'Arduino Uno R3 ATmega328P, USB data cable aur Web Serial wala browser chahiye. DUETBlox ki physical board testing abhi baaki hai.',
    steps: {
      board: {title: 'Bilkul sahi board chuniye', body: 'Boards & robots kholkar Arduino Uno R3 chuniye. Ready to connect? aur Exact model and pin capabilities padhiye. Board par lagi LED use kariye; is lesson mein bahar ki wiring nahi chahiye. Uno R4 ka adapter alag hota hai.', check: 'Maine apna board model aur USB data cable check kiya.'},
      firmware: {title: 'Live control taiyaar kariye', body: 'Agar DUETBlox Live firmware pehle se nahi hai to Prepare live firmware, phir Select port & upload chuniye. Upload se board ka abhi ka program badal jaata hai; uska source pehle sambhaliye. Sahi port chunne mein teacher ki madad lijiye.', check: 'Mere board par sahi live firmware install hai.'},
      led: {title: 'Board ki LED jalaiye aur bujhaiye', body: 'Connect board chunkar apna Uno chuniye. Connection check mein Output pin 13 rakhiye. Set HIGH, phir Set LOW dabaiye. Board par L likhi LED dekhiye aur jo sach mein hua wahi bataiye.', check: 'Maine board ki LED jalte aur bujhte dekhi.', hint: 'Kuch na badle to board, data cable, port aur live firmware check kariye. LED jawab na de tab tak is step ko poora mat maaniye.'},
      program: {title: 'Live block program banaiye', body: 'Program with blocks chuniye. Green flag event ke neeche set pin 13 mode OUTPUT, phir set digital pin 13 to HIGH, wait 1 seconds aur set digital pin 13 to LOW jodiye. Green flag se chalaiye. Live control ke liye USB juda rakhiye.', check: 'USB jude hone par mere blocks ne LED chalayi.', hint: 'USB hatane ke baad chalana alag workflow hai: when board starts → Generate Arduino code → local compiler → upload. Graphics aur image/sound/pose models browser mein rehte hain; chhote numbers models upload ho sakte hain.'}
    }
  },
  'junior-decisions': {
    title: 'Do kaamon mein se ek chuniye',
    summary: 'Keyboard se faisla lijiye aur dono branches check kariye.',
    needs: 'Keyboard use kariye. Model, camera ya board nahi chahiye.',
    steps: {
      decision: {title: 'Loop mein sawaal poochhiye', body: 'Pehle apni kahani save kariye. Junior mein script mein Control → Forever jodkar uska body kholiye. If / otherwise jodiye. Decision condition mein A key is pressed aur Decision key mein Space chuniye.', check: 'Mere loop mein Space key wala faisla hai.'},
      branches: {title: 'Har jawaab ko ek kaam dijiye', body: 'Edit then branch chunkar Go right jodiye. Back one level dabaiye, phir Edit otherwise branch mein Go left jodiye. Upar branch ka naam batata hai ki naye blocks kahan judenge.', check: 'Then mein right aur Otherwise mein left chaal hai.'},
      test: {title: 'Dono jawaab try kariye', body: 'Play story dabaiye aur stage par click karke focus dijiye. Space dabakar character dekhiye; chhodkar compare kariye. Stop story se loop rukta hai. Dono kaam sahi hon to Save story kariye.', check: 'Maine key dabane aur chhodne, dono haalat check ki.', hint: 'AI faisle ke liye If / otherwise se pehle Recognize rakhiye. Accepted prediction has a label sabse naya accept hua result check karta hai; ye khud model train ya naya input capture nahi karta.'}
    }
  },
  'board-code-check': {
    title: 'Upload se pehle board program check kariye',
    summary: 'Kaam ka error padhiye, theek kariye, phir C++ dekhiye.',
    needs: 'Check aur code generation ke liye board nahi chahiye. Compile ke liye taiyaar local compiler chahiye.',
    steps: {
      select: {title: 'Sahi target chuniye', body: 'Blocks kholiye. Coding board mein wahi board chuniye jo aap use karenge. Naye hardware pin menus us board ke hisaab se badalte hain; purane blocks ki values nahi badalti. Ek when board starts script rakhiye.', check: 'Maine board aur ek start script chuni.'},
      check: {title: 'Pehli problem dhoondhiye', body: 'Board upload check chuniye. Problem aur uska suggested next step padhiye. Select sprite se Code khulta hai aur script highlight hoti hai. Script dikh na rahi ho to workspace scroll kariye. Upload program se browser-only actions hataiye, ya poora project browser mein live chalaiye.', check: 'Main samajhta/samajhti hoon kaun se actions ko browser chahiye.'},
      code: {title: 'Bana hua program dekhiye', body: 'Jab check mein Supported for code generation dikhe, View C++ chuniye. Baar-baar hone wale kaam numeric/boolean My Blocks mein rakh sakte hain. Download .ino bana hua sketch save karta hai; upload nahi karta.', check: 'Maine apne abhi ke program ka C++ khola.'},
      verify: {title: 'Check aur hardware test ka fark samjhiye', body: 'Compile & upload se Boards & robots khulta hai. Sahi board ho tabhi local compiler aur serial upload ke steps kariye. Upload ke baad alag power dekar outputs check kariye, tabhi kahiye ki USB hatane par bhi chalta hai.', check: 'Main bata sakta/sakti hoon kis cheez ka physical test abhi baaki hai.'}
    }
  }
};

// adds .hg beside .en/.hi on the lessons above
export function addHinglish(lessons) {
  for (const lesson of lessons) {
    const h = HINGLISH[lesson.id]; if (!h) continue;
    for (const k of ['title', 'summary', 'needs']) if (h[k] && lesson[k]) lesson[k].hg = h[k];
    for (const step of lesson.steps) {
      const s = h.steps?.[step.id]; if (!s) continue;
      for (const k of ['title', 'body', 'check', 'hint']) if (s[k] && step[k]) step[k].hg = s[k];
    }
  }
  return lessons;
}
