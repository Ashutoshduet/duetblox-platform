// Six more guided lessons (Nov 2026): a game, a quiz, Pen drawing, Music, a virtual-board traffic light and a first Python program.
// Block names match the Scratch editor inside DUETBlox and its Boards and robots blocks, so students can find them as written.
const words = (en, hi, hg) => ({en, hi, hg});
const step = (id, title, body, check, hint, code) => ({id, title, body, check, ...(hint ? {hint} : {}), ...(code ? {code} : {})});

export const ROBOTICS_LAB = 'https://duetpower.in/robotics/lab/';

export const MORE_LESSONS = [
  {
    id: 'star-catch', target: 'blocks', icon: 'Gamepad2', minutes: 12, tone: 'purple',
    title: words('Make a click-the-star game', 'Star पकड़ने वाला game बनाएँ', 'Click-the-star game banaiye'),
    summary: words('A score variable, random jumps and a final result.', 'Score variable, random jumps और आख़िरी नतीजा।', 'Score variable, random jumps aur aakhri result.'),
    needs: words('Mouse or touch screen. No camera, account or board needed.', 'Mouse या touch screen. Camera, account या board की ज़रूरत नहीं।', 'Mouse ya touch screen. Camera, account ya board nahi chahiye.'),
    steps: [
      step('variable', words('Make a score variable', 'Score variable बनाएँ', 'Score variable banaiye'),
        words('Open Blocks and select your sprite. In Code → Variables choose Make a Variable, type score, keep For all sprites and choose OK. A score box appears on the stage.', 'Blocks खोलकर अपना sprite चुनें। Code → Variables में Make a Variable चुनें, score लिखें, For all sprites रहने दें और OK दबाएँ। Stage पर score का box दिखेगा।', 'Blocks kholkar apna sprite chuniye. Code → Variables mein Make a Variable chuniye, score likhiye, For all sprites rehne dijiye aur OK dabaiye. Stage par score ka box dikhega.'),
        words('I can see score on the stage.', 'मुझे stage पर score दिख रहा है।', 'Mujhe stage par score dikh raha hai.')),
      step('jump', words('Make the sprite jump around', 'Sprite को इधर-उधर कुदाएँ', 'Sprite ko idhar-udhar kudaiye'),
        words('Drag Events → when green flag clicked. Under it add Variables → set my variable to 0 and choose score in its menu. Add Control → repeat 10 and change 10 to 20. Inside the repeat put Motion → go to random position, then Control → wait 1 seconds. Click the green flag.', 'Events → when green flag clicked खींचें। उसके नीचे Variables → set my variable to 0 जोड़ें और menu में score चुनें। Control → repeat 10 जोड़कर 10 को 20 करें। Repeat के अंदर Motion → go to random position और फिर Control → wait 1 seconds रखें। Green flag दबाएँ।', 'Events → when green flag clicked kheenchiye. Uske neeche Variables → set my variable to 0 jodiye aur menu mein score chuniye. Control → repeat 10 jodkar 10 ko 20 kariye. Repeat ke andar Motion → go to random position aur phir Control → wait 1 seconds rakhiye. Green flag dabaiye.'),
        words('My sprite jumps to a new place every second.', 'मेरा sprite हर सेकंड नई जगह कूदता है।', 'Mera sprite har second nayi jagah koodta hai.'),
        words('If score is missing from the menu, make the variable first: the menu lists only variables that exist.', 'Menu में score न दिखे तो पहले variable बनाएँ: menu में सिर्फ़ बने हुए variables आते हैं।', 'Menu mein score na dikhe to pehle variable banaiye: menu mein sirf bane hue variables aate hain.')),
      step('click', words('Score a point on each click', 'हर click पर एक point', 'Har click par ek point'),
        words('Drag Events → when this sprite clicked to an empty space. Under it add Variables → change my variable by 1 (choose score), then Motion → go to random position so the same spot cannot be clicked twice. Play and click the sprite.', 'Events → when this sprite clicked को खाली जगह पर रखें। उसके नीचे Variables → change my variable by 1 (score चुनें) और फिर Motion → go to random position जोड़ें, ताकि एक ही जगह दो बार click न हो। Play करके sprite पर click करें।', 'Events → when this sprite clicked ko khaali jagah par rakhiye. Uske neeche Variables → change my variable by 1 (score chuniye) aur phir Motion → go to random position jodiye, taaki ek hi jagah do baar click na ho. Play karke sprite par click kariye.'),
        words('Each click adds exactly 1 to score.', 'हर click पर score में ठीक 1 जुड़ता है।', 'Har click par score mein theek 1 judta hai.')),
      step('finish', words('Show the result, then make it harder', 'नतीजा दिखाएँ, फिर game कठिन करें', 'Result dikhaiye, phir game mushkil kariye'),
        words('Under the repeat (not inside it) add Looks → say Hello! for 2 seconds. Drop Operators → join apple banana into its message, type Score: in the first slot and drag the score reporter into the second. Change wait 1 to wait 0.7 and predict: easier or harder? Play twice, compare, then Save project.', 'Repeat के नीचे (अंदर नहीं) Looks → say Hello! for 2 seconds जोड़ें। उसके message में Operators → join apple banana रखें, पहले खाने में Score: लिखें और दूसरे में score reporter खींचें। wait 1 को wait 0.7 करें और अनुमान लगाएँ: आसान या कठिन? दो बार खेलें, तुलना करें, फिर Save project करें।', 'Repeat ke neeche (andar nahi) Looks → say Hello! for 2 seconds jodiye. Uske message mein Operators → join apple banana rakhiye, pehle khaane mein Score: likhiye aur doosre mein score reporter kheenchiye. wait 1 ko wait 0.7 kariye aur andaaza lagaiye: aasaan ya mushkil? Do baar kheliye, compare kariye, phir Save project kariye.'),
        words('My game shows the final score and I tested a faster version.', 'मेरा game आख़िरी score दिखाता है और मैंने तेज़ version जाँचा।', 'Mera game aakhri score dikhata hai aur maine tez version check kiya.'),
        words('Variables keep their value between runs. That is why the start script sets score to 0 first.', 'Variables की value अगली बार तक बनी रहती है। इसीलिए start script पहले score को 0 करती है।', 'Variables ki value agli baar tak bani rehti hai. Isiliye start script pehle score ko 0 karti hai.'))
    ]
  },
  {
    id: 'quiz-score', target: 'blocks', icon: 'HelpCircle', minutes: 10, tone: 'pink',
    title: words('Build a quiz that checks answers', 'जवाब जाँचने वाला quiz बनाएँ', 'Jawaab check karne wala quiz banaiye'),
    summary: words('Ask, compare the answer, keep points.', 'सवाल पूछें, जवाब मिलाएँ, points जोड़ें।', 'Sawaal poochhiye, jawaab milaiye, points jodiye.'),
    needs: words('Keyboard only. No camera, account or board needed.', 'सिर्फ़ keyboard. Camera, account या board की ज़रूरत नहीं।', 'Sirf keyboard. Camera, account ya board nahi chahiye.'),
    steps: [
      step('ask', words('Ask a question', 'एक सवाल पूछें', 'Ek sawaal poochhiye'),
        words('Open Blocks. Under Events → when green flag clicked add Sensing → ask What\'s your name? and wait. Change the question to What is 7 × 8?. Click the green flag, type an answer in the box on the stage and press Enter.', 'Blocks खोलें। Events → when green flag clicked के नीचे Sensing → ask What\'s your name? and wait जोड़ें। सवाल को What is 7 × 8? करें। Green flag दबाएँ, stage के box में जवाब लिखें और Enter दबाएँ।', 'Blocks kholiye. Events → when green flag clicked ke neeche Sensing → ask What\'s your name? and wait jodiye. Sawaal ko What is 7 × 8? kariye. Green flag dabaiye, stage ke box mein jawaab likhiye aur Enter dabaiye.'),
        words('My question appears and I can type an answer.', 'मेरा सवाल दिखता है और मैं जवाब लिख सकता/सकती हूँ।', 'Mera sawaal dikhta hai aur main jawaab likh sakta/sakti hoon.')),
      step('check', words('Check the answer', 'जवाब जाँचें', 'Jawaab check kariye'),
        words('Add Control → if then else under the ask block. Put the Operators = block (50 = 50) in its slot. Drag Sensing → answer into the left side and type 56 on the right. In each branch add Looks → say Hello! for 2 seconds: Correct! in the first, Not yet: 56 in else. Test a right and a wrong answer.', 'Ask block के नीचे Control → if then else जोड़ें। उसके खाने में Operators का = block (50 = 50) रखें। बाईं ओर Sensing → answer खींचें और दाईं ओर 56 लिखें। दोनों branch में Looks → say Hello! for 2 seconds रखें: पहले में Correct!, else में Not yet: 56. सही और गलत, दोनों जवाब आज़माएँ।', 'Ask block ke neeche Control → if then else jodiye. Uske khaane mein Operators ka = block (50 = 50) rakhiye. Left side mein Sensing → answer kheenchiye aur right mein 56 likhiye. Dono branch mein Looks → say Hello! for 2 seconds rakhiye: pehle mein Correct!, else mein Not yet: 56. Sahi aur galat, dono jawaab try kariye.'),
        words('I tested both a right and a wrong answer.', 'मैंने सही और गलत, दोनों जवाब जाँचे।', 'Maine sahi aur galat, dono jawaab check kiye.'),
        words('Scratch\'s = ignores capital letters, so Delhi and delhi count as the same. It also treats 56 and 56.0 as the same number.', 'Scratch का = capital letters नहीं देखता, इसलिए Delhi और delhi एक ही माने जाते हैं। 56 और 56.0 भी एक ही संख्या हैं।', 'Scratch ka = capital letters nahi dekhta, isliye Delhi aur delhi ek hi maane jaate hain. 56 aur 56.0 bhi ek hi number hain.')),
      step('points', words('Keep points', 'Points जोड़ें', 'Points jodiye'),
        words('Make a Variable called points. Right under the green flag block add set points to 0. In the Correct! branch add change points by 1.', 'points नाम का variable बनाएँ (Make a Variable)। Green flag block के ठीक नीचे set points to 0 जोड़ें। Correct! वाली branch में change points by 1 जोड़ें।', 'points naam ka variable banaiye (Make a Variable). Green flag block ke theek neeche set points to 0 jodiye. Correct! wali branch mein change points by 1 jodiye.'),
        words('Points go up only for a correct answer.', 'Points सिर्फ़ सही जवाब पर बढ़ते हैं।', 'Points sirf sahi jawaab par badhte hain.')),
      step('more', words('Add two more questions', 'दो सवाल और जोड़ें', 'Do sawaal aur jodiye'),
        words('Right-click the ask block and choose Duplicate: it copies the block and everything under it. Snap the copy under the first if-else, then change its question and expected answer. Finish with say join Points: points. Save project.', 'Ask block पर right-click करके Duplicate चुनें: यह block और उसके नीचे का सब कुछ copy करता है। Copy को पहले if-else के नीचे जोड़ें, फिर सवाल और सही जवाब बदलें। आख़िर में say join Points: points रखें। Save project करें।', 'Ask block par right-click karke Duplicate chuniye: ye block aur uske neeche ka sab kuch copy karta hai. Copy ko pehle if-else ke neeche jodiye, phir sawaal aur sahi jawaab badliye. Aakhir mein say join Points: points rakhiye. Save project kariye.'),
        words('My quiz has three questions and shows my points.', 'मेरे quiz में तीन सवाल हैं और वह मेरे points दिखाता है।', 'Mere quiz mein teen sawaal hain aur wo mere points dikhata hai.'))
    ]
  },
  {
    id: 'pen-shapes', target: 'blocks', icon: 'PenTool', minutes: 10, tone: 'blue',
    title: words('Draw shapes with Pen and loops', 'Pen और loops से आकृतियाँ बनाएँ', 'Pen aur loops se shapes banaiye'),
    summary: words('Find the turning rule, then make a pattern.', 'मुड़ने का नियम खोजें, फिर pattern बनाएँ।', 'Mudne ka rule khojiye, phir pattern banaiye.'),
    needs: words('Uses the Pen extension, which works offline. No board needed.', 'Pen extension इस्तेमाल होता है, जो offline भी चलता है। Board की ज़रूरत नहीं।', 'Pen extension use hota hai, jo offline bhi chalta hai. Board nahi chahiye.'),
    steps: [
      step('extension', words('Add the Pen', 'Pen जोड़ें', 'Pen jodiye'),
        words('Open Blocks. Choose Add Extension at the bottom-left of the block list, then Pen. A Pen category appears with erase all, pen down and pen up.', 'Blocks खोलें। Block list के नीचे बाईं ओर Add Extension चुनें, फिर Pen। Pen category आएगी जिसमें erase all, pen down और pen up हैं।', 'Blocks kholiye. Block list ke neeche left mein Add Extension chuniye, phir Pen. Pen category aayegi jismein erase all, pen down aur pen up hain.'),
        words('I can see the Pen blocks.', 'मुझे Pen blocks दिख रहे हैं।', 'Mujhe Pen blocks dikh rahe hain.')),
      step('square', words('Draw a square', 'Square बनाएँ', 'Square banaiye'),
        words('Build this script, then click the green flag.', 'यह script बनाएँ, फिर green flag दबाएँ।', 'Ye script banaiye, phir green flag dabaiye.'),
        words('My sprite draws a square.', 'मेरा sprite square बनाता है।', 'Mera sprite square banata hai.'),
        words('A line while moving to the start? Put pen up before go to x: 0 y: 0.', 'Start पर जाते समय line बनती है? go to x: 0 y: 0 से पहले pen up रखें।', 'Start par jaate waqt line banti hai? go to x: 0 y: 0 se pehle pen up rakhiye.'),
        'when green flag clicked\nerase all\npen up\ngo to x: 0 y: 0\npoint in direction 90\npen down\nrepeat 4\n    move 100 steps\n    turn ↻ 90 degrees\npen up'),
      step('rule', words('Find the turning rule', 'मुड़ने का नियम खोजें', 'Mudne ka rule khojiye'),
        words('Going once around any shape turns 360 degrees. Change repeat to 6 and turn to 60: a hexagon. Predict the turn for 5 sides (360 ÷ 5) before testing, then try 3 sides.', 'किसी भी आकृति के एक चक्कर में कुल 360 degree घूमते हैं। repeat 6 और turn 60 करें: षट्भुज बनेगा। 5 भुजाओं का turn (360 ÷ 5) पहले सोचें, फिर जाँचें। फिर 3 भुजाएँ आज़माएँ।', 'Kisi bhi shape ke ek chakkar mein kul 360 degree ghoomte hain. repeat 6 aur turn 60 kariye: hexagon banega. 5 sides ka turn (360 ÷ 5) pehle sochiye, phir check kariye. Phir 3 sides try kariye.'),
        words('I predicted the turn for a pentagon before testing it.', 'मैंने pentagon का turn जाँचने से पहले सोचा।', 'Maine pentagon ka turn check karne se pehle socha.')),
      step('pattern', words('Make a pattern', 'Pattern बनाएँ', 'Pattern banaiye'),
        words('Put your repeat 4 inside a repeat 12. After the inner repeat add turn ↻ 30 degrees and change pen color by 10. Run it, then Save project.', 'अपने repeat 4 को repeat 12 के अंदर रखें। अंदर वाले repeat के बाद turn ↻ 30 degrees और change pen color by 10 जोड़ें। चलाएँ, फिर Save project करें।', 'Apne repeat 4 ko repeat 12 ke andar rakhiye. Andar wale repeat ke baad turn ↻ 30 degrees aur change pen color by 10 jodiye. Chalaiye, phir Save project kariye.'),
        words('I made a pattern from a repeated shape.', 'मैंने दोहराई आकृति से pattern बनाया।', 'Maine repeat hui shape se pattern banaya.'),
        words('12 × 30 = 360, so the pattern closes into a full circle.', '12 × 30 = 360, इसलिए pattern पूरा गोला बनाकर बंद होता है।', '12 × 30 = 360, isliye pattern poora gola banakar band hota hai.'))
    ]
  },
  {
    id: 'music-tune', target: 'blocks', icon: 'Music', minutes: 8, tone: 'orange',
    title: words('Compose a tune with notes', 'Notes से धुन बनाएँ', 'Notes se dhun banaiye'),
    summary: words('Notes, beats and tempo, playing together.', 'Notes, beats और tempo, एक साथ।', 'Notes, beats aur tempo, ek saath.'),
    needs: words('Uses the Music extension. Turn on speakers or headphones.', 'Music extension इस्तेमाल होता है। Speaker या headphones चालू करें।', 'Music extension use hota hai. Speaker ya headphones on kariye.'),
    steps: [
      step('extension', words('Add Music', 'Music जोड़ें', 'Music jodiye'),
        words('Open Blocks, choose Add Extension, then Music. Click play drum (1) Snare Drum for 0.25 beats in the block list to hear it.', 'Blocks खोलें, Add Extension चुनें, फिर Music। Block list में play drum (1) Snare Drum for 0.25 beats पर click करके सुनें।', 'Blocks kholiye, Add Extension chuniye, phir Music. Block list mein play drum (1) Snare Drum for 0.25 beats par click karke suniye.'),
        words('I heard a drum.', 'मैंने drum सुना।', 'Maine drum suna.')),
      step('notes', words('Play a melody', 'एक धुन बजाएँ', 'Ek dhun bajaiye'),
        words('Under when green flag clicked add play note 60 for 0.25 beats (60 is middle C). Add six more: 60, 67, 67, 69, 69, 67 — the start of Twinkle, Twinkle. Make the last one 0.5 beats. Click a note number to pick from a keyboard.', 'when green flag clicked के नीचे play note 60 for 0.25 beats जोड़ें (60 यानी middle C)। छह और जोड़ें: 60, 67, 67, 69, 69, 67 — Twinkle, Twinkle की शुरुआत। आख़िरी 0.5 beats करें। Note number पर click करके keyboard से चुन सकते हैं।', 'when green flag clicked ke neeche play note 60 for 0.25 beats jodiye (60 yaani middle C). Chhe aur jodiye: 60, 67, 67, 69, 69, 67 — Twinkle, Twinkle ki shuruaat. Aakhri wala 0.5 beats kariye. Note number par click karke keyboard se chun sakte hain.'),
        words('My tune plays the notes in order.', 'मेरी धुन notes को क्रम से बजाती है।', 'Meri dhun notes ko order mein bajati hai.')),
      step('beat', words('Add a beat underneath', 'नीचे एक beat जोड़ें', 'Neeche ek beat jodiye'),
        words('Make a second when green flag clicked script: repeat 8 with play drum (1) Snare Drum for 0.5 beats inside. Both scripts start together. Add set tempo to 60 at the top of one script to slow everything down.', 'दूसरी when green flag clicked script बनाएँ: repeat 8 के अंदर play drum (1) Snare Drum for 0.5 beats। दोनों scripts साथ शुरू होती हैं। किसी एक script के ऊपर set tempo to 60 रखकर सब धीमा करें।', 'Doosri when green flag clicked script banaiye: repeat 8 ke andar play drum (1) Snare Drum for 0.5 beats. Dono scripts saath shuru hoti hain. Kisi ek script ke upar set tempo to 60 rakhkar sab dheema kariye.'),
        words('My beat and tune play together.', 'मेरी beat और धुन साथ बजती हैं।', 'Meri beat aur dhun saath bajti hain.'),
        words('Tempo is beats per minute. At 60 one beat lasts one second.', 'Tempo यानी एक मिनट में कितनी beats। 60 पर एक beat एक सेकंड की होती है।', 'Tempo yaani ek minute mein kitni beats. 60 par ek beat ek second ki hoti hai.')),
      step('remix', words('Remix it', 'Remix करें', 'Remix kariye'),
        words('Change one note, one beat length and the instrument (set instrument to). Listen, decide which version you like, and Save project.', 'एक note, एक beat की लंबाई और instrument (set instrument to) बदलें। सुनें, तय करें कौन-सा version अच्छा है, और Save project करें।', 'Ek note, ek beat ki length aur instrument (set instrument to) badliye. Suniye, decide kariye kaun sa version accha hai, aur Save project kariye.'),
        words('I changed the tune and saved it.', 'मैंने धुन बदली और सेव की।', 'Maine dhun badli aur save ki.'))
    ]
  },
  {
    id: 'virtual-traffic-light', target: 'blocks', icon: 'TrafficCone', minutes: 12, tone: 'green',
    link: {href: `${ROBOTICS_LAB}?lesson=traffic`, label: words('Wire it in Robotics Lab 360', 'Robotics Lab 360 में wiring करें', 'Robotics Lab 360 mein wiring kariye')},
    title: words('Program a traffic light without a board', 'बिना board के traffic light चलाएँ', 'Bina board ke traffic light chalaiye'),
    summary: words('Three outputs in turn, checked on the virtual board.', 'तीन outputs बारी-बारी से, virtual board पर जाँचे।', 'Teen outputs baari-baari se, virtual board par check.'),
    needs: words('No board needed: the Virtual Board Lab runs the logic in the browser. Later, wire the real circuit in Robotics Lab 360.', 'Board नहीं चाहिए: Virtual Board Lab logic को browser में चलाता है। बाद में असली circuit Robotics Lab 360 में जोड़ें।', 'Board nahi chahiye: Virtual Board Lab logic ko browser mein chalata hai. Baad mein asli circuit Robotics Lab 360 mein jodiye.'),
    steps: [
      step('board', words('Turn on the virtual board', 'Virtual board चालू करें', 'Virtual board on kariye'),
        words('Open Blocks. Set Board to Arduino Uno R3 and choose Try virtual board. The Virtual Board Lab opens. It checks your program\'s logic, not wires or real LEDs.', 'Blocks खोलें। Board में Arduino Uno R3 रखें और Try virtual board चुनें। Virtual Board Lab खुलेगा। यह program का logic जाँचता है, तार या असली LEDs नहीं।', 'Blocks kholiye. Board mein Arduino Uno R3 rakhiye aur Try virtual board chuniye. Virtual Board Lab khulega. Ye program ka logic check karta hai, wires ya asli LEDs nahi.'),
        words('The Virtual Board Lab is open and says SIMULATION.', 'Virtual Board Lab खुला है और SIMULATION लिखा है।', 'Virtual Board Lab khula hai aur SIMULATION likha hai.')),
      step('pins', words('Give each light a pin', 'हर light को एक pin दें', 'Har light ko ek pin dijiye'),
        words('Plan: pin 13 = red, pin 12 = yellow, pin 11 = green. Under when green flag clicked add Boards and robots → set pin 13 mode OUTPUT three times and change the pins to 13, 12 and 11.', 'योजना: pin 13 = लाल, pin 12 = पीला, pin 11 = हरा। when green flag clicked के नीचे Boards and robots → set pin 13 mode OUTPUT तीन बार जोड़ें और pins 13, 12, 11 करें।', 'Plan: pin 13 = red, pin 12 = yellow, pin 11 = green. when green flag clicked ke neeche Boards and robots → set pin 13 mode OUTPUT teen baar jodiye aur pins 13, 12, 11 kariye.'),
        words('All three pins are set to OUTPUT.', 'तीनों pins OUTPUT पर हैं।', 'Teeno pins OUTPUT par hain.')),
      step('cycle', words('Make the lights take turns', 'Lights को बारी-बारी जलाएँ', 'Lights ko baari-baari jalaiye'),
        words('Add Control → forever and build the cycle below inside it. Choose Run and watch Output commands.', 'Control → forever जोड़ें और नीचे वाला cycle उसके अंदर बनाएँ। Run चुनें और Output commands देखें।', 'Control → forever jodiye aur neeche wala cycle uske andar banaiye. Run chuniye aur Output commands dekhiye.'),
        words('Output commands show red, yellow, green in order, one at a time.', 'Output commands में लाल, पीला, हरा क्रम से, एक बार में एक दिखता है।', 'Output commands mein red, yellow, green order mein, ek baar mein ek dikhta hai.'),
        words('Two lights on together means a set … to LOW block is missing or has the wrong pin.', 'दो lights साथ जलें तो कोई set … to LOW block छूटा है या उसका pin गलत है।', 'Do lights saath jalein to koi set … to LOW block chhoot gaya hai ya uska pin galat hai.'),
        'forever\n    set digital pin 13 to HIGH    (red)\n    wait 3 seconds\n    set digital pin 13 to LOW\n    set digital pin 12 to HIGH    (yellow)\n    wait 1 seconds\n    set digital pin 12 to LOW\n    set digital pin 11 to HIGH    (green)\n    wait 3 seconds\n    set digital pin 11 to LOW'),
      step('real', words('From logic to a real circuit', 'Logic से असली circuit तक', 'Logic se asli circuit tak'),
        words('A real LED also needs a resistor (about 220 Ω) and must face the right way: long leg towards the pin. Save project, then open Robotics Lab 360 (button below) to wire the same traffic light on a breadboard and see what happens without the resistor.', 'असली LED को resistor (लगभग 220 Ω) भी चाहिए और उसकी दिशा सही हो: लंबी टाँग pin की ओर। Save project करें, फिर नीचे के button से Robotics Lab 360 खोलें, वही traffic light breadboard पर जोड़ें और देखें कि resistor के बिना क्या होता है।', 'Asli LED ko resistor (lagbhag 220 Ω) bhi chahiye aur uski direction sahi ho: lambi taang pin ki taraf. Save project kariye, phir neeche ke button se Robotics Lab 360 kholiye, wahi traffic light breadboard par jodiye aur dekhiye ki resistor ke bina kya hota hai.'),
        words('I can name the parts a real traffic light needs.', 'मैं असली traffic light के पुर्ज़े बता सकता/सकती हूँ।', 'Main asli traffic light ke parts bata sakta/sakti hoon.'))
    ]
  },
  {
    id: 'python-table', target: 'python', icon: 'Code2', minutes: 10, tone: 'purple',
    title: words('Python: print any times table', 'Python: कोई भी पहाड़ा छापें', 'Python: koi bhi pahada print kariye'),
    summary: words('input(), a for loop, and reading errors.', 'input(), for loop और errors पढ़ना।', 'input(), for loop aur errors padhna.'),
    needs: words('Python runs in this browser. Prepare the offline pack once to use it without internet.', 'Python इसी browser में चलता है। Internet के बिना चलाने के लिए offline pack एक बार तैयार करें।', 'Python isi browser mein chalta hai. Internet ke bina chalane ke liye offline pack ek baar taiyaar kariye.'),
    steps: [
      step('hello', words('Run your first program', 'पहला program चलाएँ', 'Pehla program chalaiye'),
        words('Open Python. In Start with an example choose Say hello, then Load example. Type your name in Input for input() and choose Run Python. Read the Output.', 'Python खोलें। Start with an example में Say hello चुनकर Load example दबाएँ। Input for input() में अपना नाम लिखें और Run Python चुनें। Output पढ़ें।', 'Python kholiye. Start with an example mein Say hello chunkar Load example dabaiye. Input for input() mein apna naam likhiye aur Run Python chuniye. Output padhiye.'),
        words('The Output greets me by name.', 'Output मेरा नाम लेकर स्वागत करता है।', 'Output mera naam lekar welcome karta hai.'),
        words('input() reads the Input box one line at a time. An empty box gives EOFError.', 'input() Input box को एक-एक line पढ़ता है। Box खाली हो तो EOFError आता है।', 'input() Input box ko ek-ek line padhta hai. Box khaali ho to EOFError aata hai.')),
      step('loop', words('Repeat with a for loop', 'for loop से दोहराएँ', 'for loop se repeat kariye'),
        words('Replace the code with the program below. Put 7 in Input for input() and Run Python.', 'Code की जगह नीचे वाला program लिखें। Input for input() में 7 रखें और Run Python करें।', 'Code ki jagah neeche wala program likhiye. Input for input() mein 7 rakhiye aur Run Python kariye.'),
        words('I see the 7 times table from 1 to 10.', 'मुझे 7 का पहाड़ा 1 से 10 तक दिखता है।', 'Mujhe 7 ka pahada 1 se 10 tak dikhta hai.'),
        words('The 4 spaces before print put it inside the loop. In the editor, Tab inserts 4 spaces.', 'print से पहले के 4 spaces उसे loop के अंदर रखते हैं। Editor में Tab से 4 spaces आते हैं।', 'print se pehle ke 4 spaces use loop ke andar rakhte hain. Editor mein Tab se 4 spaces aate hain.'),
        'n = int(input("Which table? "))\nfor i in range(1, 11):\n    print(n, "x", i, "=", n * i)'),
      step('errors', words('Read errors like a programmer', 'Programmer की तरह errors पढ़ें', 'Programmer ki tarah errors padhiye'),
        words('Delete the colon at the end of the for line and run: read the last line of the message (SyntaxError) and its line number, then put the colon back. Now type seven in the Input box and run: int() cannot turn a word into a number (ValueError). Change it back to 7.', 'for वाली line के आख़िर का colon हटाकर चलाएँ: message की आख़िरी line (SyntaxError) और line number पढ़ें, फिर colon वापस लगाएँ। अब Input में seven लिखकर चलाएँ: int() शब्द को संख्या नहीं बना सकता (ValueError)। फिर 7 कर दें।', 'for wali line ke aakhir ka colon hatakar chalaiye: message ki aakhri line (SyntaxError) aur line number padhiye, phir colon wapas lagaiye. Ab Input mein seven likhkar chalaiye: int() word ko number nahi bana sakta (ValueError). Phir 7 kar dijiye.'),
        words('I made, read and fixed two different errors.', 'मैंने दो अलग errors बनाए, पढ़े और ठीक किए।', 'Maine do alag errors banaye, padhe aur theek kiye.')),
      step('own', words('Make it yours', 'इसे अपना बनाएँ', 'Ise apna banaiye'),
        words('Change range(1, 11) to range(1, 21) for 20 lines, or print n * n as well. Choose Download .py to keep the file, then Save project.', '20 lines के लिए range(1, 11) को range(1, 21) करें, या साथ में n * n भी छापें। File रखने के लिए Download .py चुनें, फिर Save project करें।', '20 lines ke liye range(1, 11) ko range(1, 21) kariye, ya saath mein n * n bhi print kariye. File rakhne ke liye Download .py chuniye, phir Save project kariye.'),
        words('I changed the program and kept a copy.', 'मैंने program बदला और एक copy रखी।', 'Maine program badla aur ek copy rakhi.'))
    ]
  }
];

// the order students see: the first steps, then games and art, then AI, then boards and Python
export const LESSON_ORDER = ['junior-story', 'scratch-animation', 'star-catch', 'quiz-score', 'pen-shapes', 'music-tune', 'junior-decisions', 'image-detective', 'text-greetings', 'virtual-traffic-light', 'arduino-led', 'board-code-check', 'python-table'];
