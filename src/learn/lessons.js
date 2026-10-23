const words = (en, hi) => ({en, hi});
const step = (id, title, body, check, hint) => ({id, title, body, check, ...(hint ? {hint} : {})});

// Labels inside the lessons deliberately match the current English editor controls.
// Hindi translates the explanation, while preserving the label students must find.
export const LESSONS = [
  {
    id: 'junior-story', target: 'junior', icon: 'Shapes', minutes: 5, tone: 'orange', starter: 'junior',
    title: words('Make a character tell a story', 'किरदार से कहानी बुलवाएँ'),
    summary: words('Move, speak, and change one thing at a time.', 'किरदार चलाएँ, बुलवाएँ और एक बार में एक बदलाव करें।'),
    needs: words('No camera, account, or board needed.', 'कैमरा, अकाउंट या बोर्ड की ज़रूरत नहीं।'),
    steps: [
      step('open', words('Meet your stage', 'अपने मंच को देखें'),
        words('Open Junior Blocks. Use Play story to run the current story, then Stop story. If you want a fresh example, first Save project, then download the starter below and use Open story.', 'Junior Blocks खोलें। Play story से कहानी चलाएँ, फिर Stop story दबाएँ। नया उदाहरण चाहिए तो पहले Save project करें, फिर नीचे से starter डाउनलोड करके Open story से खोलें।'),
        words('I can start and stop the story.', 'मैं कहानी चला और रोक सकता/सकती हूँ।')),
      step('change', words('Give your character a voice', 'किरदार को अपनी आवाज़ दें'),
        words('Find a Say block in the script, or choose Looks → Say to add one. Change Words to say to your own greeting. Press Play story and watch the speech bubble.', 'स्क्रिप्ट में Say ब्लॉक ढूँढें, या Looks → Say से जोड़ें। Words to say में अपना अभिवादन लिखें। Play story दबाकर बोलने वाला बुलबुला देखें।'),
        words('My character says my greeting.', 'मेरा किरदार मेरा अभिवादन बोलता है।'),
        words('Blocks run from left to right. The small arrow buttons move a block earlier or later.', 'ब्लॉक बाएँ से दाएँ चलते हैं। छोटे तीर वाले बटन से ब्लॉक आगे या पीछे करें।')),
      step('experiment', words('Make a prediction, then try it', 'पहले अनुमान लगाएँ, फिर आज़माएँ'),
        words('Choose Motion → Go right. Change its number from 1 to 3. Predict how far the character will move, then play. One square is 20 pixels. Use Reset starting positions before comparing.', 'Motion → Go right चुनें। संख्या 1 से 3 करें। अनुमान लगाएँ कि किरदार कितना चलेगा, फिर Play करें। एक square 20 pixels है। तुलना से पहले Reset starting positions दबाएँ।'),
        words('I changed a number and compared the result.', 'मैंने संख्या बदली और नतीजे की तुलना की।')),
      step('save', words('Keep your story', 'अपनी कहानी सँभालें'),
        words('Use Save story for just the Junior story, or Save project for the whole DUETBlox workspace. Keep the downloaded file in a folder you can find again.', 'सिर्फ Junior कहानी के लिए Save story करें, या पूरे DUETBlox workspace के लिए Save project करें। डाउनलोड की फ़ाइल ऐसी जगह रखें जिसे फिर ढूँढ सकें।'),
        words('I saved a copy on my computer.', 'मैंने अपने कंप्यूटर पर एक कॉपी सेव की।'))
    ]
  },
  {
    id: 'scratch-animation', target: 'blocks', icon: 'Blocks', minutes: 7, tone: 'purple',
    title: words('Build your first block sequence', 'अपना पहला ब्लॉक क्रम बनाएँ'),
    summary: words('Connect an event, a movement, and a message.', 'एक event, एक movement और एक message जोड़ें।'),
    needs: words('No camera, account, or board needed.', 'कैमरा, अकाउंट या बोर्ड की ज़रूरत नहीं।'),
    steps: [
      step('event', words('Choose when to start', 'शुरू होने का समय चुनें'),
        words('Open Blocks and select a character. In Code, drag Events → when green flag clicked into an empty part of the coding area. Keep any existing scripts; Save project first if you want a backup.', 'Blocks खोलकर किरदार चुनें। Code में Events → when green flag clicked को coding area की खाली जगह खींचें। पुरानी scripts रहने दें; बैकअप के लिए पहले Save project करें।'),
        words('My script has a green flag start block.', 'मेरी script में green flag वाला start block है।')),
      step('sequence', words('Snap two actions together', 'दो काम एक साथ जोड़ें'),
        words('Attach Motion → move 10 steps under the start block. Attach Looks → say Hello! for 2 seconds underneath. Press the green flag above the stage.', 'Start block के नीचे Motion → move 10 steps जोड़ें। उसके नीचे Looks → say Hello! for 2 seconds लगाएँ। मंच के ऊपर green flag दबाएँ।'),
        words('My character moves and then speaks.', 'मेरा किरदार पहले चलता है, फिर बोलता है।'),
        words('Other green flag scripts also run. If the result surprises you, inspect the other scripts on each character.', 'अन्य green flag scripts भी चलती हैं। नतीजा अलग हो तो हर किरदार की बाकी scripts देखें।')),
      step('loop', words('Repeat an action', 'एक काम दोहराएँ'),
        words('Wrap the move block in Control → repeat 10. Change the repeat count to 3. Predict the total movement, then run the script. Stop ends all running scripts.', 'Move block को Control → repeat 10 के अंदर रखें। Repeat की संख्या 3 करें। कुल चाल का अनुमान लगाएँ, फिर script चलाएँ। Stop से सभी चलती scripts रुकती हैं।'),
        words('I can explain why the character moves 30 steps.', 'मैं बता सकता/सकती हूँ कि किरदार 30 steps क्यों चलता है।')),
      step('save', words('Name your creation', 'अपनी रचना को नाम दें'),
        words('Change Project name at the top, then Save project. Your .duet file includes the Scratch program and the rest of your workspace.', 'ऊपर Project name बदलें, फिर Save project करें। आपकी .duet फ़ाइल में Scratch program और बाकी workspace शामिल रहते हैं।'),
        words('I named and saved my project.', 'मैंने अपने project को नाम देकर सेव किया।'))
    ]
  },
  {
    id: 'image-detective', target: 'ml', icon: 'Image', minutes: 10, tone: 'blue',
    title: words('Teach a shape detective', 'आकृति पहचानना सिखाएँ'),
    summary: words('Train, then check pictures it has never seen.', 'Train करें, फिर नई तस्वीरों से जाँचें।'),
    needs: words('Use Image learning. Prepare the image model for offline use first; a camera is optional.', 'Image learning चुनें। पहले image model को offline उपयोग के लिए तैयार करें; कैमरा वैकल्पिक है।'),
    steps: [
      step('examples', words('Start with two classes', 'दो classes से शुरू करें'),
        words('Open ML Studio → Image learning. Save project before replacing any examples. Try an example loads Orange circle and Blue square images. It replaces the current image training dataset.', 'ML Studio → Image learning खोलें। पुराने examples बदलने से पहले Save project करें। Try an example से Orange circle और Blue square तस्वीरें आती हैं। इससे मौजूदा image training dataset बदलता है।'),
        words('I can see examples for both shape classes.', 'मुझे दोनों आकृतियों की classes के examples दिख रहे हैं।')),
      step('train', words('Train the model', 'Model को train करें'),
        words('Choose Train model and wait for training to finish. A high training score only tells you how the model did on familiar examples.', 'Train model चुनें और training पूरी होने दें। ऊँचा training score सिर्फ परिचित examples का प्रदर्शन बताता है।'),
        words('My image model finished training.', 'मेरे image model की training पूरी हुई।')),
      step('test', words('Try a genuinely new picture', 'एक नई तस्वीर आज़माएँ'),
        words('Use Test image with a new orange circle or blue square you drew separately. Do not reuse a training thumbnail. Compare the label and scores with what is actually in the picture.', 'अलग से बनाए orange circle या blue square की नई तस्वीर Test image में दें। Training thumbnail दोबारा न लें। तस्वीर में असल में क्या है, उससे label और score की तुलना करें।'),
        words('I tested a picture that was not used for training.', 'मैंने ऐसी तस्वीर जाँची जो training में नहीं थी।'),
        words('The model may learn color or background instead of shape. Try the same shape in another color and discuss what happens.', 'Model आकृति की जगह रंग या background सीख सकता है। वही आकृति दूसरे रंग में आज़माएँ और नतीजा समझें।')),
      step('evaluate', words('Look for mistakes', 'गलतियाँ ढूँढें'),
        words('In Check with new examples, add separate evaluation images under the correct class. Choose Evaluate new examples. Inspect wrong labels and Unknown, then Save project to keep your examples and model.', 'Check with new examples में सही class के नीचे अलग evaluation तस्वीरें जोड़ें। Evaluate new examples चुनें। गलत labels और Unknown देखें, फिर examples और model रखने के लिए Save project करें।'),
        words('I checked new examples and can describe a limitation.', 'मैंने नए examples जाँचे और एक कमी बता सकता/सकती हूँ।'))
    ]
  },
  {
    id: 'text-greetings', target: 'ml', icon: 'MessageCircle', minutes: 7, tone: 'pink', starter: 'text',
    title: words('Teach a Hindi / English greeting helper', 'हिन्दी / English greeting helper बनाएँ'),
    summary: words('Learn word patterns and know when to say Unknown.', 'शब्दों के patterns सीखें और Unknown को समझें।'),
    needs: words('Text learning works locally without a model download or microphone.', 'Text learning स्थानीय रूप से चलता है; model download या microphone की ज़रूरत नहीं।'),
    steps: [
      step('examples', words('Collect words for two jobs', 'दो कामों के लिए वाक्य चुनें'),
        words('Open ML Studio → Text learning. Save project before replacing examples, then choose Try an example for Greeting and Goodbye. Or write at least 3 varied sentences per class and choose Add examples.', 'ML Studio → Text learning खोलें। Examples बदलने से पहले Save project करें, फिर Greeting और Goodbye के लिए Try an example चुनें। या हर class में कम से कम 3 अलग वाक्य लिखकर Add examples करें।'),
        words('Each class has different example sentences.', 'हर class में अलग-अलग उदाहरण वाक्य हैं।')),
      step('train', words('Train and inspect', 'Train करें और जाँचें'),
        words('Choose Train text model. With at least 5 unique examples per class, a Separate holdout check also runs. Read which held-out sentences were right or wrong.', 'Train text model चुनें। हर class में कम से कम 5 unique examples होने पर Separate holdout check भी चलता है। देखें कि अलग रखे किन वाक्यों का उत्तर सही या गलत आया।'),
        words('I trained a text model and checked its report.', 'मैंने text model train करके उसकी report देखी।')),
      step('unknown', words('Test a greeting and unfamiliar words', 'अभिवादन और अनजान शब्द जाँचें'),
        words('In A new sentence, try “नमस्ते दोस्त” and choose Classify text. Inspect the words that influenced the result. Then try words absent from your examples, such as “quantum zebras nebula”. No learned words should return Unknown.', 'A new sentence में “नमस्ते दोस्त” डालकर Classify text चुनें। नतीजे पर असर डालने वाले शब्द देखें। फिर examples से बाहर के शब्द जैसे “quantum zebras nebula” आज़माएँ। कोई सीखा हुआ शब्द न हो तो Unknown आना चाहिए।'),
        words('I compared a known greeting with unfamiliar words.', 'मैंने परिचित अभिवादन और अनजान शब्दों की तुलना की।'),
        words('This model counts words. It does not translate languages or understand word order, sarcasm, or meaning.', 'यह model शब्द गिनता है। यह भाषा का अनुवाद, शब्दों का क्रम, व्यंग्य या अर्थ नहीं समझता।')),
      step('blocks', words('Use your model in a program', 'Model को program में इस्तेमाल करें'),
        words('Choose Use in Blocks. Connect classify text to a start event, then put text label inside a say block. Use text prediction accepted? when your program should act only on an accepted result. Save project.', 'Use in Blocks चुनें। classify text को start event से जोड़ें, फिर text label को say block में रखें। Program केवल स्वीकार किए नतीजे पर काम करे तो text prediction accepted? इस्तेमाल करें। Save project करें।'),
        words('I used a text prediction in a block program.', 'मैंने block program में text prediction इस्तेमाल किया।'))
    ]
  },
  {
    id: 'arduino-led', target: 'boards', icon: 'Cpu', minutes: 12, tone: 'green',
    title: words('Meet the Arduino Uno LED', 'Arduino Uno की LED चलाएँ'),
    summary: words('Check the board, connect, and try HIGH / LOW.', 'बोर्ड जाँचें, connect करें और HIGH / LOW आज़माएँ।'),
    needs: words('Requires an Arduino Uno R3 ATmega328P, a USB data cable, and a browser with Web Serial. Physical testing is still pending for DUETBlox.', 'Arduino Uno R3 ATmega328P, USB data cable और Web Serial वाला browser चाहिए। DUETBlox का physical board testing अभी बाकी है।'),
    steps: [
      step('board', words('Match the exact board', 'सही board model चुनें'),
        words('Open Boards & robots and select Arduino Uno R3. Check Ready to connect? and Exact model and pin capabilities. Use the onboard LED; this lesson needs no external wiring. An Uno R4 needs a different adapter.', 'Boards & robots खोलकर Arduino Uno R3 चुनें। Ready to connect? और Exact model and pin capabilities पढ़ें। Onboard LED इस्तेमाल करें; बाहरी wiring की ज़रूरत नहीं। Uno R4 का adapter अलग होगा।'),
        words('I checked my board model and USB data cable.', 'मैंने board model और USB data cable जाँची।')),
      step('firmware', words('Prepare live control', 'Live control तैयार करें'),
        words('If DUETBlox Live firmware is not already installed, choose Prepare live firmware, then Select port & upload. Uploading replaces the board’s current program; keep its source first. Ask your instructor to help select the correct port.', 'अगर DUETBlox Live firmware पहले से नहीं है, तो Prepare live firmware और फिर Select port & upload चुनें। Upload करने से board का मौजूदा program बदलता है; उसका source पहले सँभालें। सही port चुनने में शिक्षक की मदद लें।'),
        words('The matching live firmware is installed on my board.', 'मेरे board पर सही live firmware install है।')),
      step('led', words('Turn the onboard LED on and off', 'Onboard LED जलाएँ और बुझाएँ'),
        words('Choose Connect board and select your Uno. In Connection check, use Output pin 13. Choose Set HIGH, then Set LOW. Look at the onboard LED marked L and report what actually happens.', 'Connect board चुनकर अपना Uno चुनें। Connection check में Output pin 13 रखें। Set HIGH, फिर Set LOW दबाएँ। Board पर L वाली LED देखें और वास्तविक नतीजा बताएँ।'),
        words('I observed the onboard LED turn on and off.', 'मैंने onboard LED जलते और बुझते देखी।'),
        words('If nothing changes, check the exact board, data cable, port, and live firmware. Do not mark this step complete until you see the LED respond.', 'अगर कुछ नहीं बदलता तो board, data cable, port और live firmware जाँचें। LED प्रतिक्रिया न दे तो इस step को पूरा न मानें।')),
      step('program', words('Make a live block program', 'Live block program बनाएँ'),
        words('Choose Program with blocks. Under a green flag event, add set pin 13 mode OUTPUT, then set digital pin 13 to HIGH, wait 1 seconds, and set digital pin 13 to LOW. Run it with the green flag. Keep USB connected for live control.', 'Program with blocks चुनें। Green flag event के नीचे set pin 13 mode OUTPUT, फिर set digital pin 13 to HIGH, wait 1 seconds और set digital pin 13 to LOW जोड़ें। Green flag से चलाएँ। Live control में USB जुड़ा रखें।'),
        words('My blocks controlled the LED while USB was connected.', 'USB जुड़े होने पर मेरे blocks ने LED चलाई।'),
        words('Running after unplugging is a separate workflow: when board starts → Generate Arduino code → local compiler → upload. Graphics and image/sound/pose models stay in the browser; small numbers models can be uploaded.', 'USB हटाने के बाद चलाना अलग workflow है: when board starts → Generate Arduino code → local compiler → upload। Graphics और image/sound/pose models browser में रहते हैं; छोटे numbers models upload हो सकते हैं।'))
    ]
  }
  ,{
    id: 'junior-decisions', target: 'junior', icon: 'Shapes', minutes: 8, tone: 'orange',
    title: words('Choose between two actions', 'दो कामों में से एक चुनें'),
    summary: words('Make a keyboard decision and test both branches.', 'Keyboard से निर्णय लें और दोनों branches जाँचें।'),
    needs: words('Use a keyboard. No model, camera or board needed.', 'Keyboard इस्तेमाल करें। Model, camera या board की ज़रूरत नहीं।'),
    steps: [
      step('decision', words('Ask a question in a loop', 'Loop में सवाल पूछें'),
        words('Save your current story first. In Junior, add Control → Forever to a script and open its body. Add If / otherwise. Set Decision condition to A key is pressed, and Decision key to Space.', 'पहले अपनी कहानी सेव करें। Junior में script में Control → Forever जोड़कर उसका body खोलें। If / otherwise जोड़ें। Decision condition में A key is pressed और Decision key में Space चुनें।'),
        words('My loop contains a Space-key decision.', 'मेरे loop में Space-key का निर्णय है।')),
      step('branches', words('Give each answer an action', 'हर जवाब को एक काम दें'),
        words('Choose Edit then branch and add Go right. Use Back one level, then Edit otherwise branch and add Go left. The branch breadcrumb shows where new blocks will go.', 'Edit then branch चुनकर Go right जोड़ें। Back one level दबाएँ, फिर Edit otherwise branch में Go left जोड़ें। ऊपर branch का नाम बताता है कि नए blocks कहाँ जुड़ेंगे।'),
        words('Then moves right; Otherwise moves left.', 'Then में दाएँ और Otherwise में बाएँ चाल है।')),
      step('test', words('Try both answers', 'दोनों जवाब आज़माएँ'),
        words('Press Play story, then click the stage to focus it. Hold Space and watch the character; release it and compare. Stop story ends the loop. Save story when both actions work.', 'Play story दबाएँ और stage पर click करके focus दें। Space दबाकर किरदार देखें; छोड़कर नतीजा तुलना करें। Stop story से loop रुकता है। दोनों काम सही हों तो Save story करें।'),
        words('I tested the pressed and released key states.', 'मैंने key दबाने और छोड़ने, दोनों स्थितियाँ जाँचीं।'),
        words('For an AI decision, place Recognize before If / otherwise. Accepted prediction has a label checks the latest accepted result; it does not train a model or capture new input by itself.', 'AI निर्णय के लिए If / otherwise से पहले Recognize रखें। Accepted prediction has a label सबसे हाल के स्वीकार किए result को जाँचता है; खुद model train या नया input capture नहीं करता।'))
    ]
  },{
    id: 'board-code-check', target: 'blocks', icon: 'Cpu', minutes: 8, tone: 'green',
    title: words('Check a board program before uploading', 'Upload से पहले board program जाँचें'),
    summary: words('Read a useful error, fix it, then inspect the C++.', 'काम का error पढ़ें, उसे सुधारें और C++ देखें।'),
    needs: words('Checking and code generation need no physical board. Compilation needs the prepared local compiler.', 'Check और code generation के लिए board नहीं चाहिए। Compilation के लिए तैयार local compiler चाहिए।'),
    steps: [
      step('select', words('Choose the real target', 'सही target चुनें'),
        words('Open Blocks. In Coding board, choose the exact board you intend to use. New hardware pin menus follow that board; old blocks keep their existing values. Use one when board starts script.', 'Blocks खोलें। Coding board में अपना सही board चुनें। नए hardware pin menus उस board के अनुसार बदलते हैं; पुराने blocks की values नहीं बदलतीं। एक when board starts script इस्तेमाल करें।'),
        words('I selected a board and one start script.', 'मैंने board और एक start script चुनी।')),
      step('check', words('Find the first issue', 'पहली समस्या ढूँढें'),
        words('Choose Board upload check. Read the issue and its suggested next step. Select sprite opens Code and highlights its script. Scroll the workspace if the script is outside view. Remove browser-only actions from this upload program, or keep the whole project live in the browser.', 'Board upload check चुनें। समस्या और सुझाया अगला कदम पढ़ें। Select sprite से Code खुलता है और script चमकती है। Script बाहर हो तो workspace scroll करें। Upload program से browser-only actions हटाएँ, या पूरा project browser में live चलाएँ।'),
        words('I understand which actions need the browser.', 'मैं समझता/समझती हूँ कि किन actions को browser चाहिए।')),
      step('code', words('Inspect the generated program', 'बना हुआ program देखें'),
        words('When the check says Supported for code generation, choose View C++. You can use numeric/boolean My Blocks to organize repeated actions. Download .ino saves the generated sketch; it does not upload it.', 'जब Supported for code generation दिखे, View C++ चुनें। दोहराए जाने वाले काम numeric/boolean My Blocks में रख सकते हैं। Download .ino बना sketch सेव करता है; upload नहीं करता।'),
        words('I opened the C++ for my current program.', 'मैंने अपने मौजूदा program का C++ देखा।')),
      step('verify', words('Separate checking from hardware testing', 'Check और hardware test का फर्क समझें'),
        words('Compile & upload opens Boards & robots. Follow its local compiler and serial upload steps only when the exact board is available. After upload, test the intended outputs with independent power before claiming it runs after unplugging.', 'Compile & upload से Boards & robots खुलता है। सही board उपलब्ध होने पर local compiler और serial upload के steps करें। Upload के बाद अलग power देकर सही outputs जाँचें, तभी USB हटाकर चलने का दावा करें।'),
        words('I can explain what still needs a physical test.', 'मैं बता सकता/सकती हूँ कि किस बात का physical test बाकी है।'))
    ]
  }
];

export const lessonById = id => LESSONS.find(lesson => lesson.id === id);
export const translate = (value, locale) => value[locale] || value.en;
