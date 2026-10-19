# Demo content of the Listening course (F05C, D100–D104): original scripts
# written for AppEnglish, free to use. build.py turns them into recordings
# (Windows voices), subtitles and pack.json; the content-service seed script
# loads pack.json.
#
# Per level: one unit of three lessons, its unit check, a level test of two
# recordings, and three placement questions on the unit check's recording.
#
# A question is (prompt, right answer, [wrong answers], explanation[, skill]);
# skill is 'gist', 'detail' (default) or 'inference'. build.py shuffles the
# options. A line is (speaker, text); speaker 'W' and 'M' are the two Windows
# voices, shown as Woman and Man; a talk has one voice and no speaker label.

W, M = 'W', 'M'


def q(prompt, right, wrong, explanation, skill='detail'):
    return {'prompt': prompt, 'right': right, 'wrong': wrong, 'explanation': explanation, 'skill': skill}


def talk(voice, *lines):
    return [(voice + ':talk', line) for line in lines]


LEVELS = []

# ---------------------------------------------------------------- A1
LEVELS.append({
    'level': 'A1',
    'rate': -3,
    'unit': {'title': 'Everyday life', 'description': 'Meeting people, ordering a drink and talking about family.'},
    'lessons': [
        {
            'title': 'Meeting a new classmate',
            'kind': 'part3',
            'lines': [
                (W, "Hi, I'm Lan. Are you new here?"),
                (M, 'Yes, I am. My name is Tom.'),
                (W, 'Nice to meet you, Tom. Where are you from?'),
                (M, "I'm from Canada. I live near the school now."),
                (W, 'Oh, I live near the school too.'),
                (M, 'Great! We can walk to class together.'),
            ],
            'keywords': [('new', 'mới'), ('classmate', 'bạn cùng lớp'), ('near', 'gần'), ('together', 'cùng nhau')],
            'gist': q('What are the speakers doing?', 'Meeting for the first time', ['Buying a book', 'Talking about a film'], 'Lan asks "Are you new here?" and they say their names.', 'gist'),
            'detail': [
                q('Where is Tom from?', 'Canada', ['England', 'Australia'], 'Tom says: "I\'m from Canada."'),
                q('What can they do together?', 'Walk to class', ['Eat lunch', 'Play football'], 'Tom says: "We can walk to class together."'),
            ],
            'close': [1, 3],
        },
        {
            'title': 'At the café',
            'kind': 'part3',
            'lines': [
                (M, 'Good morning. What would you like?'),
                (W, 'Can I have a tea, please?'),
                (M, 'Hot or iced?'),
                (W, 'Hot, please. And a small cake.'),
                (M, "That's four dollars."),
                (W, 'Here you are. Thank you.'),
            ],
            'keywords': [('would like', 'muốn'), ('hot', 'nóng'), ('small', 'nhỏ'), ('dollar', 'đô la')],
            'gist': q('Where are the speakers?', 'In a café', ['In a bank', 'At a bus stop'], 'The man asks what she would like, and she orders tea and cake.', 'gist'),
            'detail': [
                q('What does the woman order to drink?', 'A hot tea', ['An iced coffee', 'A glass of milk'], 'She asks for a tea and says "Hot, please."'),
                q('How much does she pay?', 'Four dollars', ['Two dollars', 'Ten dollars'], 'The man says: "That\'s four dollars."'),
            ],
            'close': [1, 4],
        },
        {
            'title': 'My family',
            'kind': 'part4',
            'lines': talk(W,
                'Hello, my name is Mai.',
                'There are four people in my family.',
                'My father is a teacher and my mother is a nurse.',
                'I have one brother. His name is Nam.',
                'He is ten years old and he likes football.',
                "On Sundays, we have dinner at my grandmother's house.",
            ),
            'keywords': [('family', 'gia đình'), ('teacher', 'giáo viên'), ('nurse', 'y tá'), ('brother', 'anh/em trai')],
            'gist': q('What is the talk about?', "Mai's family", ["Mai's school", "Mai's house"], 'Mai talks about her father, mother and brother.', 'gist'),
            'detail': [
                q("What does Mai's mother do?", 'She is a nurse', ['She is a teacher', 'She is a cook'], 'Mai says: "my mother is a nurse."'),
                q('How old is Nam?', 'Ten', ['Twelve', 'Eight'], 'Mai says: "He is ten years old."'),
            ],
            'close': [2, 4],
        },
    ],
    'check': {
        'title': 'Buying fruit',
        'kind': 'part3',
        'lines': [
            (M, 'Hello. Do you have apples today?'),
            (W, 'Yes, we have red apples and green apples.'),
            (M, 'How much are the red apples?'),
            (W, 'They are two dollars a kilo.'),
            (M, 'OK, one kilo of red apples, please. And three bananas.'),
            (W, "Sure. That's three dollars and fifty cents."),
        ],
        'questions': [
            q('Where are the speakers?', 'At a fruit shop', ['At a school', 'At a hospital'], 'They talk about apples and bananas and their prices.', 'gist'),
            q('What colours are the apples?', 'Red and green', ['Red and yellow', 'Only green'], 'The woman says: "we have red apples and green apples."'),
            q('How much is a kilo of red apples?', 'Two dollars', ['Three dollars', 'Fifty cents'], 'The woman says: "They are two dollars a kilo."'),
            q('How many bananas does the man buy?', 'Three', ['Two', 'Five'], 'The man asks for "three bananas."'),
            q('How much does the man pay?', 'Three dollars fifty', ['Two dollars', 'Four dollars fifty'], 'The woman says: "That\'s three dollars and fifty cents."'),
        ],
        'placement': [
            q('What does the man ask first?', 'If they have apples', ['Where the bank is', 'What time it is'], 'He asks: "Do you have apples today?"'),
            q('What does the man buy with the apples?', 'Bananas', ['Oranges', 'Bread'], 'He also asks for three bananas.'),
            q('Who is selling the fruit?', 'The woman', ['The man', 'A child'], 'The woman says "we have" apples and tells him the price.', 'inference'),
        ],
    },
    'test': {
        'title': 'A1 listening test',
        'sections': [
            {
                'title': 'Asking for directions',
                'kind': 'part3',
                'lines': [
                    (M, 'Excuse me. Where is the post office?'),
                    (W, "It's on Green Street, next to the bank."),
                    (M, 'Is it far from here?'),
                    (W, "No, it's about five minutes on foot."),
                    (M, 'Do I turn left or right at the corner?'),
                    (W, 'Turn right, then go straight.'),
                    (M, 'Thank you very much.'),
                ],
                'questions': [
                    q('What is the man looking for?', 'The post office', ['The bank', 'A hotel'], 'He asks: "Where is the post office?"', 'gist'),
                    q('Where is it?', 'Next to the bank', ['Behind the school', 'Near the park'], 'The woman says it is "next to the bank."'),
                    q('How long is the walk?', 'About five minutes', ['About fifteen minutes', 'About an hour'], 'She says: "about five minutes on foot."'),
                    q('What should he do at the corner?', 'Turn right', ['Turn left', 'Stop and wait'], 'She says: "Turn right, then go straight."'),
                ],
            },
            {
                'title': 'A message from a friend',
                'kind': 'part4',
                'lines': talk(M,
                    "Hi Anna, it's Ben.",
                    "I'm at the cinema, but the film starts at seven, not six.",
                    'Can you come at a quarter to seven?',
                    'I have the tickets.',
                    "After the film, let's eat pizza.",
                    'Call me back, OK? Bye!',
                ),
                'questions': [
                    q('Where is Ben?', 'At the cinema', ['At home', 'At a restaurant'], 'Ben says: "I\'m at the cinema."'),
                    q('What time does the film start?', 'At seven', ['At six', 'At a quarter to seven'], 'Ben says the film "starts at seven, not six."'),
                    q('What does Ben have?', 'The tickets', ['The pizza', "Anna's phone"], 'Ben says: "I have the tickets."'),
                    q('What do they plan to do after the film?', 'Eat pizza', ['Go shopping', 'Go home'], 'Ben says: "After the film, let\'s eat pizza."'),
                ],
            },
        ],
    },
})

# ---------------------------------------------------------------- A2
LEVELS.append({
    'level': 'A2',
    'rate': -2,
    'unit': {'title': 'Plans and places', 'description': 'Booking, weekend plans and a city tour.'},
    'lessons': [
        {
            'title': 'Booking a table',
            'kind': 'part3',
            'lines': [
                (W, "Good afternoon, Rosa's Restaurant."),
                (M, "Hi, I'd like to book a table for Saturday evening."),
                (W, 'Of course. For how many people?'),
                (M, "For six, please. It's my mother's birthday."),
                (W, 'We have a table at eight o\'clock. Is that OK?'),
                (M, 'Perfect. Could we sit near the window?'),
                (W, 'Sure. Can I have your name, please?'),
                (M, "It's David Clark."),
            ],
            'keywords': [('book', 'đặt chỗ'), ('evening', 'buổi tối'), ('birthday', 'sinh nhật'), ('window', 'cửa sổ')],
            'gist': q('Why is the man calling?', 'To book a table', ['To order food for delivery', 'To complain about a meal'], 'He says: "I\'d like to book a table for Saturday evening."', 'gist'),
            'detail': [
                q('How many people will come?', 'Six', ['Four', 'Eight'], 'He says: "For six, please."'),
                q('Where does he want to sit?', 'Near the window', ['Outside', 'Near the kitchen'], 'He asks: "Could we sit near the window?"'),
            ],
            'close': [3, 5],
        },
        {
            'title': 'Weekend plans',
            'kind': 'part3',
            'lines': [
                (M, 'Are you doing anything this weekend, Sara?'),
                (W, "I'm going to visit my aunt in the countryside on Saturday."),
                (M, 'That sounds nice. How are you getting there?'),
                (W, 'By train. It takes about two hours.'),
                (M, 'Will you be back on Sunday?'),
                (W, 'Yes, in the afternoon. Why?'),
                (M, "There's a concert in the park on Sunday evening. Do you want to come?"),
                (W, "I'd love to!"),
            ],
            'keywords': [('countryside', 'nông thôn'), ('aunt', 'cô, dì'), ('concert', 'buổi hòa nhạc'), ('be back', 'trở về')],
            'gist': q('What are they talking about?', 'Plans for the weekend', ['A problem at work', 'A trip they took last year'], 'He asks: "Are you doing anything this weekend?"', 'gist'),
            'detail': [
                q('How is Sara travelling?', 'By train', ['By car', 'By bus'], 'She says: "By train. It takes about two hours."'),
                q('Will Sara go to the concert?', 'Yes, she will', ['No, she is busy', "She doesn't know yet"], 'She says "I\'d love to!" and she is back on Sunday afternoon.', 'inference'),
            ],
            'close': [1, 6],
        },
        {
            'title': 'A city bus tour',
            'kind': 'part4',
            'lines': talk(W,
                'Welcome aboard the City Explorer bus tour.',
                'The tour takes ninety minutes and makes six stops.',
                'Our first stop is the old market, where you can try local food.',
                'You can get off at any stop and catch the next bus thirty minutes later.',
                'Please keep your ticket with you, because the driver will check it.',
                'Free water is available at the front of the bus.',
                'Enjoy the tour!',
            ),
            'keywords': [('aboard', 'trên xe, trên tàu'), ('stop', 'điểm dừng'), ('local', 'địa phương'), ('available', 'có sẵn')],
            'gist': q('Who is speaking?', 'A tour guide on a bus', ['A teacher in a classroom', 'A pilot on a plane'], 'The speaker welcomes people "aboard the City Explorer bus tour."', 'gist'),
            'detail': [
                q('How long is the tour?', 'Ninety minutes', ['Thirty minutes', 'Six hours'], 'The guide says: "The tour takes ninety minutes."'),
                q('What should passengers keep with them?', 'Their ticket', ['Their water bottle', 'A map'], 'The guide says: "Please keep your ticket with you."'),
            ],
            'close': [1, 3],
        },
    ],
    'check': {
        'title': 'At the train station',
        'kind': 'part3',
        'lines': [
            (W, 'Excuse me, when is the next train to Brighton?'),
            (M, 'The next one leaves at ten fifteen from platform four.'),
            (W, 'Oh, I have to wait forty minutes. Is there an earlier bus?'),
            (M, "Yes, there's a bus at nine fifty, but it takes longer."),
            (W, 'How much longer?'),
            (M, 'About half an hour more than the train.'),
            (W, "Then I'll take the train. One single ticket, please."),
            (M, "That's twelve pounds."),
        ],
        'questions': [
            q('What does the woman want to do?', 'Travel to Brighton', ['Meet a friend', 'Buy a bus pass'], 'She asks about "the next train to Brighton."', 'gist'),
            q('When does the next train leave?', 'At ten fifteen', ['At nine fifty', 'At ten forty'], 'The man says: "The next one leaves at ten fifteen."'),
            q('Which platform does the train leave from?', 'Platform four', ['Platform two', 'Platform fourteen'], 'He says: "from platform four."'),
            q("Why doesn't she take the bus?", 'It takes longer', ['It is more expensive', 'It is full'], 'The bus takes "about half an hour more than the train."', 'inference'),
            q('How much is her ticket?', 'Twelve pounds', ['Twenty pounds', 'Forty pounds'], 'The man says: "That\'s twelve pounds."'),
        ],
        'placement': [
            q('How long must she wait for the train?', 'Forty minutes', ['Fifteen minutes', 'Half an hour'], 'She says: "I have to wait forty minutes."'),
            q('What kind of ticket does she buy?', 'A single ticket', ['A return ticket', 'A weekly ticket'], 'She asks for "One single ticket."'),
            q('Who is the man?', 'A station worker', ['A bus driver', 'Another passenger'], 'He knows the train times and sells her the ticket.', 'inference'),
        ],
    },
    'test': {
        'title': 'A2 listening test',
        'sections': [
            {
                'title': "At the doctor's",
                'kind': 'part3',
                'lines': [
                    (M, 'Good morning. What seems to be the problem?'),
                    (W, "I've had a bad headache for three days, and I feel tired all the time."),
                    (M, 'Are you sleeping well?'),
                    (W, "Not really. I've been working late every night this week."),
                    (M, 'I think you need more rest. Try to go to bed before eleven.'),
                    (W, 'Should I take any medicine?'),
                    (M, 'You can take this for the headache, twice a day after meals.'),
                    (W, 'Thank you, doctor.'),
                ],
                'questions': [
                    q('What is wrong with the woman?', 'She has a headache', ['She has a broken arm', 'She has a stomach ache'], 'She says: "I\'ve had a bad headache."', 'gist'),
                    q('How long has she had the problem?', 'Three days', ['A week', 'Two days'], 'She says: "for three days."'),
                    q("Why isn't she sleeping well?", 'She has been working late', ['Her neighbours are noisy', 'She drinks too much coffee'], 'She says: "I\'ve been working late every night this week."'),
                    q('How often should she take the medicine?', 'Twice a day', ['Once a day', 'Three times a day'], 'The doctor says: "twice a day after meals."'),
                ],
            },
            {
                'title': 'Weekend weather',
                'kind': 'part4',
                'lines': talk(M,
                    'Here is the weather for the weekend.',
                    'On Saturday morning it will be cloudy, with some rain in the afternoon.',
                    'Temperatures will reach about fifteen degrees.',
                    'Sunday will be much better, with sunshine all day.',
                    'It will also be warmer, around twenty degrees.',
                    'So if you are planning a picnic, Sunday is the day to do it.',
                ),
                'questions': [
                    q('What is this?', 'A weather report', ['A sports report', 'An advertisement'], 'It begins: "Here is the weather for the weekend."', 'gist'),
                    q('When will it rain?', 'On Saturday afternoon', ['On Sunday morning', 'All weekend'], '"Saturday … with some rain in the afternoon."'),
                    q('How warm will it be on Sunday?', 'Around twenty degrees', ['About fifteen degrees', 'Below ten degrees'], '"It will also be warmer, around twenty degrees."'),
                    q('Which day is better for a picnic?', 'Sunday', ['Saturday', 'Neither day'], '"Sunday is the day to do it."'),
                ],
            },
        ],
    },
})

# ---------------------------------------------------------------- B1
LEVELS.append({
    'level': 'B1',
    'rate': -1,
    'unit': {'title': 'Work and study', 'description': 'An interview, a return at a shop and tips for studying.'},
    'lessons': [
        {
            'title': 'A job interview',
            'kind': 'part3',
            'lines': [
                (W, 'Thanks for coming in, James. Can you tell me why you applied for this job?'),
                (M, "Sure. I've worked in a shop for two years, and I want to move into marketing."),
                (W, 'What do you think you are good at?'),
                (M, "I'm good at talking to customers, and I enjoy working in a team."),
                (W, 'This job sometimes means working at weekends. Would that be a problem?'),
                (M, 'Not at all. My weekends are usually free.'),
                (W, "Great. We'll let you know our decision by Friday."),
            ],
            'keywords': [('apply for', 'ứng tuyển'), ('marketing', 'tiếp thị'), ('customer', 'khách hàng'), ('decision', 'quyết định')],
            'gist': q('What is happening?', 'A job interview', ['A shopping trip', 'A team meeting'], 'The woman asks James why he applied for the job.', 'gist'),
            'detail': [
                q('How long has James worked in a shop?', 'Two years', ['Five years', 'Six months'], 'He says: "I\'ve worked in a shop for two years."'),
                q('When will he hear the decision?', 'By Friday', ['Next month', 'At the weekend'], 'She says: "We\'ll let you know our decision by Friday."'),
            ],
            'close': [1, 3],
        },
        {
            'title': 'Returning a product',
            'kind': 'part3',
            'lines': [
                (M, 'Hi, I bought these headphones here last week, but the left side has stopped working.'),
                (W, "I'm sorry to hear that. Do you have the receipt?"),
                (M, 'Yes, here it is.'),
                (W, 'Thank you. Would you like a replacement or your money back?'),
                (M, "I'd prefer a replacement, if you have the same model."),
                (W, 'Let me check. Yes, we have one in black, but not in white.'),
                (M, 'Black is fine.'),
                (W, "Here you are. If there's another problem, you can bring them back within a year."),
            ],
            'keywords': [('receipt', 'hóa đơn'), ('replacement', 'đồ thay thế'), ('model', 'mẫu, đời'), ('within', 'trong vòng')],
            'gist': q('Why is the man in the shop?', 'His headphones are broken', ['He wants to buy a phone', 'He lost his receipt'], '"the left side has stopped working."', 'gist'),
            'detail': [
                q('What does the man choose?', 'A replacement', ['His money back', 'A different product'], 'He says: "I\'d prefer a replacement."'),
                q('What colour were his first headphones probably?', 'White', ['Black', 'Red'], 'The shop has the model in black "but not in white", and he accepts black instead.', 'inference'),
            ],
            'close': [0, 4],
        },
        {
            'title': 'Tips for studying',
            'kind': 'part4',
            'lines': talk(W,
                'Many students study for hours but still forget what they learned.',
                'Here are three simple tips that can help.',
                'First, study in short sessions of about thirty minutes, then take a five-minute break.',
                'Second, test yourself instead of just reading your notes again.',
                'Trying to remember information makes it stay in your memory longer.',
                'Finally, get enough sleep, because your brain organises new information while you sleep.',
                'Try these tips for one week and see the difference.',
            ),
            'keywords': [('session', 'buổi, phiên'), ('break', 'giờ nghỉ'), ('memory', 'trí nhớ'), ('organise', 'sắp xếp')],
            'gist': q('What is the main purpose of the talk?', 'To give advice on studying', ['To advertise a school', 'To explain how sleep works'], 'The speaker gives "three simple tips" for studying.', 'gist'),
            'detail': [
                q('How long should one study session be?', 'About thirty minutes', ['About five minutes', 'About two hours'], '"study in short sessions of about thirty minutes."'),
                q('Why is sleep important, according to the talk?', 'The brain organises new information', ['It makes students less hungry', 'Teachers recommend it'], '"your brain organises new information while you sleep."'),
            ],
            'close': [2, 4],
        },
    ],
    'check': {
        'title': 'Planning a team event',
        'kind': 'part3',
        'lines': [
            (W, 'We need to choose something for the team event next month. Any ideas?'),
            (M, 'How about a cooking class? Everyone works together, and we eat at the end.'),
            (W, "That's a good idea, but it might be expensive for twenty people."),
            (M, "True. What about a picnic by the lake? It's free, apart from the food."),
            (W, 'The weather could be a problem in April, though.'),
            (M, "Then let's book the cooking class and ask the company to pay half."),
            (W, "OK, I'll write to the manager today."),
        ],
        'questions': [
            q('What are they planning?', 'A team event', ['A birthday party', 'A business trip'], '"We need to choose something for the team event."', 'gist'),
            q("What is the man's first idea?", 'A cooking class', ['A picnic', 'A football match'], 'He says: "How about a cooking class?"'),
            q('What is the problem with the cooking class?', 'It might be expensive', ['It is too far', 'It is too short'], '"it might be expensive for twenty people."'),
            q('What is the problem with the picnic?', 'The weather', ['The cost', 'The lake is closed'], '"The weather could be a problem in April."'),
            q('What will the woman do today?', 'Write to the manager', ['Book the picnic', 'Call the cooking school'], 'She says: "I\'ll write to the manager today."'),
        ],
        'placement': [
            q('How many people are in the team?', 'Twenty', ['Ten', 'Thirty'], '"it might be expensive for twenty people."'),
            q('When is the event?', 'In April', ['In May', 'Next week'], 'The event is "next month" and she talks about the weather "in April."', 'inference'),
            q('How much will the company be asked to pay?', 'Half', ['All of it', 'Nothing'], '"ask the company to pay half."'),
        ],
    },
    'test': {
        'title': 'B1 listening test',
        'sections': [
            {
                'title': 'A new apartment',
                'kind': 'part3',
                'lines': [
                    (M, "So, how's the new apartment?"),
                    (W, "I love it. It's much bigger than my old place, and it's close to the station."),
                    (M, 'What about the rent?'),
                    (W, "It's a bit higher, but I'm saving money because I don't need the bus anymore."),
                    (M, 'Do you get on with your neighbours?'),
                    (W, "I've only met one. She's lived there for ten years and she's very friendly."),
                    (M, 'You should have a party to meet the others.'),
                    (W, "Maybe once I've unpacked all the boxes!"),
                ],
                'questions': [
                    q('What does the woman like about the apartment?', "It's bigger and near the station", ["It's cheaper and quiet", 'It has a garden'], '"It\'s much bigger … and it\'s close to the station."', 'gist'),
                    q('Why is she saving money?', "She doesn't need the bus", ['Her rent is lower', 'She cooks at home'], '"I don\'t need the bus anymore."'),
                    q('What do we learn about her neighbour?', 'She has lived there for ten years', ['She is moving out', 'She is a student'], '"She\'s lived there for ten years."'),
                    q("Why hasn't she had a party yet?", "She hasn't finished unpacking", ["She doesn't like parties", 'Her neighbours are unfriendly'], '"Maybe once I\'ve unpacked all the boxes!"', 'inference'),
                ],
            },
            {
                'title': 'Museum audio guide',
                'kind': 'part4',
                'lines': talk(M,
                    'Welcome to the Science Museum.',
                    'This guide will take you through our three main galleries.',
                    "On the ground floor, you'll find the space gallery, where you can see a real rocket engine.",
                    'The first floor is about the human body and has many hands-on activities for children.',
                    'Please note that photography with a flash is not allowed in the galleries.',
                    'The café on the second floor closes an hour before the museum, at four o\'clock.',
                ),
                'questions': [
                    q('What can visitors see on the ground floor?', 'A rocket engine', ['A dinosaur', 'A human heart'], '"you can see a real rocket engine."'),
                    q('What is the first floor about?', 'The human body', ['Space', 'Machines'], '"The first floor is about the human body."'),
                    q('What is not allowed in the galleries?', 'Flash photography', ['Food', 'Children'], '"photography with a flash is not allowed."'),
                    q('When does the museum close?', "At five o'clock", ["At four o'clock", "At six o'clock"], 'The café closes at four, "an hour before the museum."', 'inference'),
                ],
            },
        ],
    },
})

# ---------------------------------------------------------------- B2
LEVELS.append({
    'level': 'B2',
    'rate': 0,
    'unit': {'title': 'Society and change', 'description': 'Working from home, food waste and customer service.'},
    'lessons': [
        {
            'title': 'Working from home',
            'kind': 'part3',
            'lines': [
                (M, 'Our company is letting us work from home three days a week now.'),
                (W, 'Lucky you! Do you think you will be more productive?'),
                (M, "Honestly, I'm not sure. I save an hour of travelling, but I get distracted easily at home."),
                (W, 'Maybe you need a separate space to work in, not the kitchen table.'),
                (M, "That's a good point. I also worry about losing touch with my colleagues."),
                (W, 'You could use the office days for meetings and teamwork, and keep the home days for focused tasks.'),
                (M, "That makes sense. I'll try organising my week like that."),
            ],
            'keywords': [('productive', 'năng suất'), ('distracted', 'mất tập trung'), ('colleague', 'đồng nghiệp'), ('focused', 'tập trung')],
            'gist': q('What is the conversation mainly about?', 'The pros and cons of working from home', ['Finding a new job', 'Moving to a new office'], 'They talk about the benefits and problems of working at home.', 'gist'),
            'detail': [
                q('What problem does the man mention?', 'He gets distracted easily', ['His internet is slow', 'His boss calls too often'], '"I get distracted easily at home."'),
                q('What does the woman suggest using office days for?', 'Meetings and teamwork', ['Focused tasks', 'Training courses'], '"use the office days for meetings and teamwork."'),
            ],
            'close': [2, 5],
        },
        {
            'title': 'Reducing food waste',
            'kind': 'part4',
            'lines': talk(W,
                'Around a third of all food produced in the world is never eaten.',
                'In wealthy countries, much of this waste happens at home rather than on farms or in factories.',
                "People often buy more than they need, especially when supermarkets offer deals like 'buy one, get one free'.",
                'Another cause is confusion over date labels.',
                "'Best before' only refers to quality, so food is usually still safe to eat after that date.",
                'Planning meals for the week and checking the fridge before shopping can make a real difference.',
            ),
            'keywords': [('produce', 'sản xuất'), ('wealthy', 'giàu có'), ('label', 'nhãn'), ('quality', 'chất lượng')],
            'gist': q('What is the talk mainly about?', 'Why food is wasted and how to reduce it', ['How supermarkets set prices', 'How to eat a healthy diet'], 'It gives causes of food waste and ways to waste less.', 'gist'),
            'detail': [
                q('Where does much food waste happen in wealthy countries?', 'At home', ['On farms', 'In restaurants'], '"much of this waste happens at home."'),
                q("What does 'best before' refer to?", 'Quality', ['Safety', 'Price'], "\"'Best before' only refers to quality.\""),
            ],
            'close': [1, 4],
        },
        {
            'title': 'A customer complaint',
            'kind': 'part3',
            'lines': [
                (W, "Hello, I'm calling about an order I placed two weeks ago. It still hasn't arrived."),
                (M, "I'm sorry about that. Could you give me your order number?"),
                (W, "It's four, seven, two, nine, one."),
                (M, 'Thank you. I can see the parcel was sent to your old address.'),
                (W, 'But I updated my address in my account last month!'),
                (M, "You're right, and I apologise. I'll send a new parcel today by express delivery, free of charge."),
                (W, 'Thank you. Will I get a tracking number?'),
                (M, "Yes, you'll receive it by email within an hour."),
            ],
            'keywords': [('order', 'đơn hàng'), ('parcel', 'bưu kiện'), ('apologise', 'xin lỗi'), ('tracking number', 'mã theo dõi')],
            'gist': q('Why is the woman calling?', "Her order hasn't arrived", ['She wants to cancel an order', 'She was charged twice'], '"I\'m calling about an order … It still hasn\'t arrived."', 'gist'),
            'detail': [
                q('What went wrong?', 'The parcel went to her old address', ['The parcel was damaged', 'The order number was wrong'], '"the parcel was sent to your old address."'),
                q('How will the new parcel be sent?', 'By express delivery at no cost', ['By normal post', 'She must collect it'], '"by express delivery, free of charge."'),
            ],
            'close': [4, 5],
        },
    ],
    'check': {
        'title': 'City bike scheme',
        'kind': 'part4',
        'lines': talk(M,
            'The city council has announced that its bike-sharing scheme will double in size next spring.',
            'Since it started two years ago, the scheme has recorded more than a million journeys.',
            'However, some residents complain that bikes are often left blocking pavements.',
            'To deal with this, riders will soon have to end their journeys at official parking points, or pay a fine.',
            'The council also plans to add electric bikes, which will cost slightly more to rent.',
            'Supporters say the changes will encourage more people to leave their cars at home.',
        ),
        'questions': [
            q('What is the news about?', 'Changes to a bike-sharing scheme', ['A new bus service', 'A cycling race'], '"its bike-sharing scheme will double in size."', 'gist'),
            q('How long has the scheme existed?', 'Two years', ['One year', 'Five years'], '"Since it started two years ago."'),
            q('What do some residents complain about?', 'Bikes block pavements', ['Bikes are too expensive', 'There are not enough bikes'], '"bikes are often left blocking pavements."'),
            q('What will riders have to do?', 'End journeys at official parking points', ['Wear helmets', 'Register online'], '"end their journeys at official parking points, or pay a fine."'),
            q('What is said about the electric bikes?', 'They will cost slightly more', ['They will be free for students', 'They will only run at weekends'], '"which will cost slightly more to rent."'),
        ],
        'placement': [
            q('When will the scheme double in size?', 'Next spring', ['Next month', 'In two years'], '"will double in size next spring."'),
            q('How many journeys has the scheme recorded?', 'More than a million', ['About a thousand', 'Exactly two million'], '"more than a million journeys."'),
            q('What do supporters believe?', 'Fewer people will drive', ['Bikes will become cheaper', 'The fines are unfair'], '"encourage more people to leave their cars at home."', 'inference'),
        ],
    },
    'test': {
        'title': 'B2 listening test',
        'sections': [
            {
                'title': 'Choosing a candidate',
                'kind': 'part3',
                'lines': [
                    (W, "So, we've interviewed both candidates. Who do you think we should hire?"),
                    (M, 'Clara has more experience, but Daniel seemed more enthusiastic about the role.'),
                    (W, "Experience matters, though. The project starts in three weeks and there's no time for long training."),
                    (M, 'True, but Clara asked for a salary well above our budget.'),
                    (W, 'Could we offer her a smaller salary with a bonus at the end of the project?'),
                    (M, "It's worth trying. If she says no, we'll offer the job to Daniel."),
                ],
                'questions': [
                    q('What are they discussing?', 'Which candidate to hire', ['A project budget report', 'A new training course'], '"Who do you think we should hire?"', 'gist'),
                    q("What is Daniel's strength?", 'He seemed more enthusiastic', ['He has more experience', 'He already knows the project'], '"Daniel seemed more enthusiastic about the role."'),
                    q('What is the problem with Clara?', 'Her salary request is too high', ["She can't start in three weeks", 'She has no experience'], '"Clara asked for a salary well above our budget."'),
                    q('What will happen if Clara refuses the offer?', 'The job will go to Daniel', ['They will interview again', 'They will raise the budget'], '"If she says no, we\'ll offer the job to Daniel."'),
                ],
            },
            {
                'title': 'Why we need sleep',
                'kind': 'part4',
                'lines': talk(W,
                    'Scientists used to think that sleep was simply a time for the body to rest.',
                    'We now know that the brain is surprisingly active during the night.',
                    'During deep sleep, it removes waste products that build up while we are awake.',
                    'Lack of sleep has been linked to poor concentration, weaker memory and a higher risk of illness.',
                    'Adults generally need between seven and nine hours a night.',
                    'Yet surveys suggest that a third of adults regularly sleep less than that.',
                ),
                'questions': [
                    q('What did scientists use to believe?', 'Sleep was just a time for the body to rest', ['Sleep improved eyesight', 'Sleep was not necessary'], '"sleep was simply a time for the body to rest."'),
                    q('What happens during deep sleep?', 'The brain removes waste products', ['The heart stops for a while', 'The body grows taller'], '"During deep sleep, it removes waste products."'),
                    q('How much sleep do adults need?', 'Seven to nine hours', ['Five to six hours', 'Ten to twelve hours'], '"between seven and nine hours a night."'),
                    q('What can we conclude about many adults?', "They don't get enough sleep", ['They sleep too much', 'They sleep only during the day'], '"a third of adults regularly sleep less than that."', 'inference'),
                ],
            },
        ],
    },
})

# ---------------------------------------------------------------- C1
LEVELS.append({
    'level': 'C1',
    'rate': 0,
    'unit': {'title': 'Ideas and arguments', 'description': 'Green cities, a negotiation and algorithms in hiring.'},
    'lessons': [
        {
            'title': 'Green spaces in cities',
            'kind': 'part4',
            'lines': talk(M,
                'Urban planners have long treated parks as a pleasant extra, something to add once the essential infrastructure is in place.',
                'That view is increasingly hard to defend.',
                'A growing body of research links access to green space with lower stress levels, better mental health and even reduced crime.',
                'Trees also lower street temperatures by several degrees during heatwaves, which could save lives as summers become hotter.',
                'The challenge is that land in city centres is extremely valuable, so councils face constant pressure to sell it to developers.',
                'Some cities have responded creatively, turning disused railway lines and rooftops into public gardens.',
            ),
            'keywords': [('infrastructure', 'cơ sở hạ tầng'), ('defend', 'bảo vệ (quan điểm)'), ('heatwave', 'đợt nắng nóng'), ('disused', 'bỏ hoang, không dùng nữa')],
            'gist': q("What is the speaker's main argument?", 'Green spaces are essential, not optional', ['Parks are too expensive to maintain', 'Cities should stop building railways'], 'Treating parks as "a pleasant extra" is "increasingly hard to defend."', 'gist'),
            'detail': [
                q('What benefit of trees is mentioned?', 'They lower street temperatures', ['They increase land prices', 'They attract tourists'], '"Trees also lower street temperatures by several degrees."'),
                q('Why is it hard to create green spaces in city centres?', 'The land is very valuable', ["People don't use parks", 'Trees grow badly in cities'], '"land in city centres is extremely valuable."'),
            ],
            'close': [2, 4],
        },
        {
            'title': 'Negotiating a contract',
            'kind': 'part3',
            'lines': [
                (W, "We've reviewed your proposal, and while we like the design, the price is higher than we'd anticipated."),
                (M, "I understand. The figure reflects the custom software we'd be building specifically for your stores."),
                (W, 'Would there be any flexibility if we committed to a three-year contract instead of one?'),
                (M, 'There could be. A longer commitment would let us spread the development costs, so we might reduce the annual fee by around ten percent.'),
                (W, "That's encouraging. We'd also need the system running before the holiday season."),
                (M, "That's ambitious, but feasible if we can sign by the end of this month."),
                (W, "Then let's aim for that. I'll take the revised figures to our board on Thursday."),
            ],
            'keywords': [('anticipate', 'dự tính'), ('flexibility', 'sự linh hoạt'), ('commit to', 'cam kết'), ('feasible', 'khả thi')],
            'gist': q('What is the conversation?', 'A negotiation over price and timing', ['A job interview', 'A complaint about faulty software'], 'They discuss the price, a longer contract and a deadline.', 'gist'),
            'detail': [
                q('What could reduce the annual fee?', 'A three-year contract', ['Using standard software', 'Paying in advance'], '"A longer commitment … we might reduce the annual fee."'),
                q('What does the man think of the deadline?', 'Difficult but possible', ['Impossible', 'Very easy'], '"That\'s ambitious, but feasible."', 'inference'),
            ],
            'close': [3, 5],
        },
        {
            'title': 'Algorithms in hiring',
            'kind': 'part4',
            'lines': talk(W,
                'More and more companies now use algorithms to screen job applications before a human ever reads them.',
                'Supporters argue that software is faster and, in theory, less prone to personal prejudice than a tired recruiter.',
                'Critics point out, however, that an algorithm trained on past hiring decisions may simply learn to repeat past biases.',
                "In one widely reported case, a system downgraded applications that mentioned women's sports clubs.",
                'The question, then, is not whether to use these tools, but how to audit them.',
                'Several governments are now considering rules that would require companies to explain how automated decisions are made.',
            ),
            'keywords': [('algorithm', 'thuật toán'), ('prejudice', 'định kiến'), ('bias', 'sự thiên lệch'), ('audit', 'kiểm tra, đánh giá')],
            'gist': q('What is the talk mainly about?', 'The risks of hiring algorithms and how to control them', ['How to write a good job application', 'Why companies should hire more athletes'], 'It weighs supporters and critics, then asks "how to audit them."', 'gist'),
            'detail': [
                q('What do critics say?', 'Algorithms may repeat past biases', ['Algorithms are too slow', 'Algorithms are too expensive'], '"may simply learn to repeat past biases."'),
                q("What is the speaker's view?", 'The tools can be used but must be checked', ['The tools should be banned', 'The tools need no rules'], '"not whether to use these tools, but how to audit them."', 'inference'),
            ],
            'close': [2, 4],
        },
    ],
    'check': {
        'title': 'Tourism: a mixed blessing',
        'kind': 'part3',
        'lines': [
            (M, 'Your town has seen visitor numbers triple in five years. Is that good news?'),
            (W, 'Economically, yes. Hotels and restaurants are thriving, and young people no longer need to leave to find work.'),
            (M, 'But I gather not everyone is pleased.'),
            (W, "That's right. Rents have soared because so many flats are now let to tourists, and some families have been priced out entirely."),
            (M, 'What is the council doing about it?'),
            (W, "We've introduced a cap on short-term rentals in the old town, and a small tourist tax that funds affordable housing."),
            (M, 'Has it made a difference?'),
            (W, "It's early days, but rents have at least stopped rising."),
        ],
        'questions': [
            q('What is the interview about?', 'The effects of tourism on a town', ['Planning a holiday', 'The history of an old town'], 'They discuss the good and bad sides of more visitors.', 'gist'),
            q('How have visitor numbers changed?', 'They have tripled', ['They have doubled', 'They have fallen'], '"visitor numbers triple in five years."'),
            q('What economic benefit is mentioned?', 'Young people can find work locally', ['Rents have fallen', 'There are fewer cars'], '"young people no longer need to leave to find work."'),
            q('What has caused problems?', 'Many flats are rented to tourists', ['Hotels are closing', 'The old town is full of cars'], '"so many flats are now let to tourists."'),
            q('What has happened so far?', 'Rents have stopped rising', ['Rents have fallen sharply', 'Nothing has changed'], '"rents have at least stopped rising."'),
        ],
        'placement': [
            q('What does the tourist tax pay for?', 'Affordable housing', ['New hotels', 'Street cleaning'], '"a small tourist tax that funds affordable housing."'),
            q('Where is the cap on short-term rentals?', 'In the old town', ['Across the whole country', 'Near the airport'], '"a cap on short-term rentals in the old town."'),
            q("What is the woman's attitude to the measures?", 'Cautiously positive', ['Completely satisfied', 'Strongly opposed'], '"It\'s early days, but rents have at least stopped rising."', 'inference'),
        ],
    },
    'test': {
        'title': 'C1 listening test',
        'sections': [
            {
                'title': 'Puzzling survey results',
                'kind': 'part3',
                'lines': [
                    (W, "I've been going through the survey results, and something doesn't add up."),
                    (M, 'In what way?'),
                    (W, 'Customers say price is their main concern, yet our cheapest product is the one selling worst.'),
                    (M, 'Perhaps people say one thing and do another. Price might be what they think they ought to care about.'),
                    (W, "Or the packaging makes it look low quality, so they assume it won't last."),
                    (M, "That's plausible. We could test it by selling it in different packaging in a few stores for a month."),
                    (W, "Good idea. If sales rise, we'll know packaging is the issue rather than the price."),
                ],
                'questions': [
                    q('What are they discussing?', 'Puzzling survey results about a product', ['Changing a supplier', 'Hiring a researcher'], '"something doesn\'t add up" in the survey results.', 'gist'),
                    q('What seems contradictory?', 'Price matters to customers, but the cheapest product sells worst', ['The survey was too short', 'Customers complain about the staff'], '"price is their main concern, yet our cheapest product is the one selling worst."'),
                    q("What is the woman's explanation?", 'The packaging makes it look low quality', ['It is too expensive', 'It is hard to find in stores'], '"the packaging makes it look low quality."'),
                    q('What will they do?', 'Test new packaging in some stores', ['Lower the price', 'Stop selling the product'], '"selling it in different packaging in a few stores for a month."'),
                ],
            },
            {
                'title': 'Nudging behaviour',
                'kind': 'part4',
                'lines': talk(M,
                    'Traditional economics assumed that people make rational choices based on all available information.',
                    'Behavioural economists have shown that, in practice, our decisions are heavily shaped by how options are presented.',
                    'For example, when employees are automatically enrolled in a pension plan, with the option to leave, participation rises dramatically.',
                    'Nothing about the plan itself has changed; only the default has.',
                    "Governments have embraced such 'nudges' because they are cheap and preserve freedom of choice.",
                    'Critics, though, warn that the same techniques can easily be used to manipulate rather than to help.',
                ),
                'questions': [
                    q('What did traditional economics assume?', 'People make rational choices', ['People simply copy others', 'People ignore prices'], '"people make rational choices based on all available information."'),
                    q('What does the pension example show?', 'Defaults change behaviour', ['Higher pay increases saving', 'People dislike pensions'], '"Nothing about the plan itself has changed; only the default has."'),
                    q('Why do governments like nudges?', 'They are cheap and keep freedom of choice', ['They force people to act', 'They raise taxes'], '"because they are cheap and preserve freedom of choice."'),
                    q('What do critics warn?', 'Nudges can be used to manipulate', ['Nudges are too expensive', 'Nudges never work'], '"can easily be used to manipulate rather than to help."'),
                ],
            },
        ],
    },
})
