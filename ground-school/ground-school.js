const STORAGE_PREFIX = 'privatePilotGroundSchool.';
const TOTAL_WEEKS = 52;
const STUDY_DAYS_PER_WEEK = 6;
const DAY_LABELS = ['Study Day 1', 'Study Day 2', 'Study Day 3', 'Study Day 4', 'Study Day 5', 'Study Day 6', 'Review Day'];

const subjectKeywordMap = [
    ['certification', 'Pilot Certification'],
    ['aerodynamic', 'Aerodynamics'],
    ['system', 'Aircraft Systems'],
    ['instrument', 'Flight Instruments'],
    ['weight', 'Weight and Balance'],
    ['performance', 'Aircraft Performance'],
    ['weather', 'Weather Theory'],
    ['metar', 'METARs and TAFs'],
    ['airspace', 'Airspace'],
    ['airport', 'Airports'],
    ['communication', 'ATC Communication'],
    ['navigation', 'Navigation'],
    ['sectional', 'Sectional Charts'],
    ['regulation', 'Regulations'],
    ['aeromedical', 'Aeromedical Factors'],
    ['risk', 'Risk Management'],
    ['cross-country', 'Cross-Country Planning'],
    ['emergency', 'Emergency Procedures']
];

function mapWeekSubjectToQuizSubject(mainSubject) {
    const match = subjectKeywordMap.find(([needle]) => mainSubject.toLowerCase().includes(needle));
    return match ? match[1] : 'Pilot Certification';
}

const phaseBlueprints = [
    {
        name: 'Orientation, Certification, and Aviation Basics',
        weeks: [
            {
                mainSubject: 'Private pilot path and study setup',
                phakTopic: 'Pilot certification, privileges, and training flow',
                jeppTopic: 'Starting private pilot training and building a home study routine',
                objective: 'Understand the certificate path, required documents, and how to study consistently before flight training.',
                keyTerms: ['student pilot certificate', 'medical certificate', 'logbook', 'endorsement', 'knowledge test']
            },
            {
                mainSubject: 'FAA structure and aviation vocabulary',
                phakTopic: 'FAA publications, aviation language, and aircraft categories',
                jeppTopic: 'Pilot terminology, aircraft classes, and training references',
                objective: 'Get comfortable with the FAA reference system and the language used throughout training.',
                keyTerms: ['advisory circular', 'aircraft category', 'class rating', 'AIM', 'training syllabus']
            },
            {
                mainSubject: 'Airplane anatomy and basic forces',
                phakTopic: 'Parts of an airplane and the four forces of flight',
                jeppTopic: 'Airplane structure and introductory flight principles',
                objective: 'Build a solid mental model of airplane components and the forces they manage in flight.',
                keyTerms: ['lift', 'weight', 'thrust', 'drag', 'stability']
            },
            {
                mainSubject: 'Runways, traffic patterns, and aviation culture',
                phakTopic: 'Airport operations, runway orientation, and safe habits',
                jeppTopic: 'Ground operations, traffic pattern flow, and cockpit discipline',
                objective: 'Learn how pilots think about airport movement, runway use, and disciplined cockpit routines.',
                keyTerms: ['runway heading', 'traffic pattern', 'taxiway', 'checklist discipline', 'situational awareness']
            }
        ]
    },
    {
        name: 'Aerodynamics and Airplane Systems',
        weeks: [
            {
                mainSubject: 'Aerodynamic principles',
                phakTopic: 'How airfoils create lift and how angle of attack changes performance',
                jeppTopic: 'Lift production, drag, and practical angle-of-attack thinking',
                objective: 'Understand the airflow concepts that explain stall behavior and control response.',
                keyTerms: ['airfoil', 'angle of attack', 'boundary layer', 'induced drag', 'parasite drag']
            },
            {
                mainSubject: 'Stability, control, and stalls',
                phakTopic: 'Longitudinal, lateral, and directional stability with stall development',
                jeppTopic: 'Control surfaces, stability design, and stall recognition',
                objective: 'Link control inputs and airplane stability to safe stall avoidance and recovery thinking.',
                keyTerms: ['aileron', 'elevator', 'rudder', 'stability', 'critical angle']
            },
            {
                mainSubject: 'Powerplants and propellers',
                phakTopic: 'Reciprocating engines, ignition, lubrication, and propeller basics',
                jeppTopic: 'Engine systems and propeller performance in training aircraft',
                objective: 'Learn how the engine and propeller turn fuel into thrust and where operating limits matter.',
                keyTerms: ['magneto', 'mixture', 'detonation', 'propeller pitch', 'oil pressure']
            },
            {
                mainSubject: 'Fuel, electrical, and hydraulic systems',
                phakTopic: 'Fuel delivery, electrical supply, and common system indications',
                jeppTopic: 'Aircraft systems monitoring and common malfunctions',
                objective: 'Recognize the purpose of basic systems and the cockpit indications tied to them.',
                keyTerms: ['alternator', 'battery', 'circuit breaker', 'fuel selector', 'hydraulic pressure']
            },
            {
                mainSubject: 'Environmental, pitot-static, and vacuum systems',
                phakTopic: 'Heating, ventilation, pitot-static plumbing, and gyroscopic support systems',
                jeppTopic: 'Instrument support systems and cold-weather considerations',
                objective: 'Understand which systems support the instrument panel and how failures present themselves.',
                keyTerms: ['pitot tube', 'static port', 'vacuum pump', 'carburetor heat', 'defrost']
            },
            {
                mainSubject: 'System failures and abnormal indications',
                phakTopic: 'Recognizing and responding to basic aircraft system abnormalities',
                jeppTopic: 'Checklist-based abnormal system management',
                objective: 'Practice identifying early signs of system trouble and matching them to sensible pilot actions.',
                keyTerms: ['abnormal checklist', 'low voltage', 'rough engine', 'fuel imbalance', 'partial failure']
            }
        ]
    },
    {
        name: 'Flight Instruments, Performance, and Weight and Balance',
        weeks: [
            {
                mainSubject: 'Pitot-static instruments',
                phakTopic: 'Airspeed, altimeter, and vertical speed indications',
                jeppTopic: 'Reading and cross-checking pitot-static instruments',
                objective: 'Learn what the primary pressure instruments actually measure and how errors can appear.',
                keyTerms: ['indicated airspeed', 'pressure altitude', 'density altitude', 'VSI', 'instrument error']
            },
            {
                mainSubject: 'Gyroscopic instruments and headings',
                phakTopic: 'Attitude, heading, and turn instruments with gyroscopic principles',
                jeppTopic: 'Instrument interpretation and common heading/attitude errors',
                objective: 'Understand how gyros work and why they still demand a good instrument scan.',
                keyTerms: ['rigidity in space', 'precession', 'attitude indicator', 'heading indicator', 'turn coordinator']
            },
            {
                mainSubject: 'Performance charts and density altitude',
                phakTopic: 'Takeoff, landing, climb, and cruise performance planning',
                jeppTopic: 'Practical use of performance charts before each flight',
                objective: 'Build confidence using charts to predict runway, climb, and cruise capability.',
                keyTerms: ['performance chart', 'pressure altitude', 'density altitude', 'headwind component', 'takeoff distance']
            },
            {
                mainSubject: 'Weight and balance foundations',
                phakTopic: 'Moments, center of gravity, and loading effects',
                jeppTopic: 'Weight and balance problem solving for training aircraft',
                objective: 'Calculate loading safely and understand why center of gravity shifts matter.',
                keyTerms: ['arm', 'moment', 'datum', 'center of gravity', 'useful load']
            },
            {
                mainSubject: 'Operational loading scenarios',
                phakTopic: 'Passenger, baggage, and fuel loading tradeoffs',
                jeppTopic: 'Scenario-based balance and performance decisions',
                objective: 'Use loading math to compare real trip scenarios and reject unsafe configurations.',
                keyTerms: ['loading envelope', 'baggage area', 'fuel burn', 'aft CG', 'forward CG']
            },
            {
                mainSubject: 'Performance and loading review',
                phakTopic: 'Integrating chart work with weight and balance decisions',
                jeppTopic: 'Combined scenario review for runway, climb, and load planning',
                objective: 'Blend weight, balance, and performance thinking into one preflight decision process.',
                keyTerms: ['takeoff margin', 'climb gradient', 'landing roll', 'balance check', 'operational buffer']
            }
        ]
    },
    {
        name: 'Weather Theory and Aviation Weather Services',
        weeks: [
            {
                mainSubject: 'Atmosphere and weather basics',
                phakTopic: 'Structure of the atmosphere, pressure, temperature, and moisture',
                jeppTopic: 'Core weather theory for pilots',
                objective: 'Learn the big weather drivers so later forecast products make sense.',
                keyTerms: ['troposphere', 'pressure', 'temperature lapse rate', 'humidity', 'dew point']
            },
            {
                mainSubject: 'Clouds, fronts, and air masses',
                phakTopic: 'Air mass behavior, fronts, stability, and cloud formation',
                jeppTopic: 'Fronts, clouds, and practical weather pattern recognition',
                objective: 'Recognize the weather signatures that affect flight conditions and visibility.',
                keyTerms: ['air mass', 'cold front', 'warm front', 'stability', 'ceiling']
            },
            {
                mainSubject: 'Wind, turbulence, and thunderstorms',
                phakTopic: 'Wind generation, turbulence sources, convection, and thunderstorm hazards',
                jeppTopic: 'Hazardous weather and pilot avoidance decisions',
                objective: 'Identify turbulence and convective risk before it becomes an in-flight surprise.',
                keyTerms: ['convection', 'wind shear', 'microburst', 'gust front', 'cumulonimbus']
            },
            {
                mainSubject: 'Icing, fog, and visibility',
                phakTopic: 'Structural icing, fog types, and reduced-visibility hazards',
                jeppTopic: 'Cold-weather hazards and visibility planning',
                objective: 'Understand how moisture and temperature combine to create high-risk conditions.',
                keyTerms: ['rime ice', 'clear ice', 'advection fog', 'radiation fog', 'freezing level']
            },
            {
                mainSubject: 'METARs, TAFs, and weather reports',
                phakTopic: 'Decoding observations and terminal forecasts',
                jeppTopic: 'Using weather text products in preflight planning',
                objective: 'Decode common weather products quickly and translate them into go/no-go thinking.',
                keyTerms: ['METAR', 'TAF', 'visibility', 'ceiling', 'trend group']
            },
            {
                mainSubject: 'Weather charts and briefing services',
                phakTopic: 'Weather depiction charts, radar, prognostic charts, and briefing sources',
                jeppTopic: 'Flight briefing workflow and weather decision review',
                objective: 'Combine multiple weather sources into one coherent preflight briefing.',
                keyTerms: ['prog chart', 'radar summary', 'surface analysis', 'AIRMET', 'SIGMET']
            },
            {
                mainSubject: 'Weather decision scenarios',
                phakTopic: 'Weather-related aeronautical decision making',
                jeppTopic: 'Scenario-based weather risk management',
                objective: 'Practice weather judgment by comparing marginal and favorable flight scenarios.',
                keyTerms: ['personal minimums', 'risk tolerance', 'escape route', 'trend', 'alternate plan']
            },
            {
                mainSubject: 'Weather phase review',
                phakTopic: 'Comprehensive review of weather theory and services',
                jeppTopic: 'Integrated weather recap for the private pilot exam',
                objective: 'Consolidate weather concepts and close any knowledge gaps before moving on.',
                keyTerms: ['briefing package', 'forecast confidence', 'hazard awareness', 'weather trend', 'conservative choice']
            }
        ]
    },
    {
        name: 'Airports, Airspace, ATC, and Communications',
        weeks: [
            {
                mainSubject: 'Airport layout and lighting',
                phakTopic: 'Airport signs, markings, lighting systems, and surface movement',
                jeppTopic: 'Airport familiarization and runway environment cues',
                objective: 'Recognize key airport markings and lighting systems that support safe ground and flight operations.',
                keyTerms: ['hold short line', 'taxiway sign', 'PAPI', 'REIL', 'runway incursion']
            },
            {
                mainSubject: 'Airspace classes and entry rules',
                phakTopic: 'Controlled and uncontrolled airspace structure',
                jeppTopic: 'Airspace operating rules for VFR pilots',
                objective: 'Know what airspace you are in, who you need to talk to, and what weather minimums apply.',
                keyTerms: ['Class B', 'Class C', 'Class D', 'Class E', 'Class G']
            },
            {
                mainSubject: 'Special use and other airspace',
                phakTopic: 'Restricted, prohibited, warning, MOA, and alert areas',
                jeppTopic: 'How special airspace affects route planning',
                objective: 'Understand how special-use airspace shapes routing and pilot caution.',
                keyTerms: ['restricted area', 'MOA', 'warning area', 'prohibited area', 'alert area']
            },
            {
                mainSubject: 'Radio phraseology and CTAF habits',
                phakTopic: 'Basic radio communication, common traffic advisory frequency, and position reports',
                jeppTopic: 'Communication routines at towered and non-towered airports',
                objective: 'Build clean, concise radio habits for both self-announce and ATC environments.',
                keyTerms: ['CTAF', 'UNICOM', 'readback', 'position report', 'standard phraseology']
            },
            {
                mainSubject: 'Tower, approach, and flight following',
                phakTopic: 'ATC services and pilot-controller responsibilities',
                jeppTopic: 'Working with tower, approach, and radar services',
                objective: 'Understand what help ATC can provide and what still remains the pilot’s responsibility.',
                keyTerms: ['flight following', 'traffic advisory', 'clearance', 'squawk code', 'radar service']
            },
            {
                mainSubject: 'Lost comm and communication review',
                phakTopic: 'Communication failures, light gun signals, and review of airport operations',
                jeppTopic: 'Comms troubleshooting and airport/airspace recap',
                objective: 'Review communication, airport, and airspace knowledge as one connected operating system.',
                keyTerms: ['light gun signal', 'communication failure', 'transponder', 'pattern entry', 'clearance limit']
            }
        ]
    },
    {
        name: 'Navigation, Charts, GPS, VOR, and Flight Planning',
        weeks: [
            {
                mainSubject: 'Pilotage and dead reckoning',
                phakTopic: 'Visual navigation, course lines, and time-distance-fuel planning',
                jeppTopic: 'Basic VFR navigation methods and checkpoint selection',
                objective: 'Plan a simple route using visual references and time calculations.',
                keyTerms: ['pilotage', 'dead reckoning', 'checkpoint', 'true course', 'magnetic variation']
            },
            {
                mainSubject: 'Sectional chart interpretation',
                phakTopic: 'Sectional symbols, terrain, obstacles, and chart scales',
                jeppTopic: 'Reading sectionals efficiently for route and airspace awareness',
                objective: 'Translate sectional symbols into practical route, airspace, and terrain decisions.',
                keyTerms: ['maximum elevation figure', 'isogonic line', 'obstruction', 'VFR checkpoint', 'chart scale']
            },
            {
                mainSubject: 'VOR navigation fundamentals',
                phakTopic: 'VOR indications, radials, tracking, and intercept concepts',
                jeppTopic: 'Using VORs for training and backup navigation',
                objective: 'Understand how VOR information is organized and how to track with it correctly.',
                keyTerms: ['radial', 'OBS', 'TO/FROM', 'course deviation indicator', 'intercept angle']
            },
            {
                mainSubject: 'GPS and situational awareness tools',
                phakTopic: 'GPS use, moving maps, and automation awareness',
                jeppTopic: 'Modern cockpit navigation and automation discipline',
                objective: 'Use GPS intelligently without losing basic navigation awareness.',
                keyTerms: ['waypoint', 'direct-to', 'moving map', 'automation management', 'cross-check']
            },
            {
                mainSubject: 'Nav logs and wind correction',
                phakTopic: 'Wind triangle, groundspeed, heading correction, and nav log setup',
                jeppTopic: 'Flight planning calculations and route preparation',
                objective: 'Calculate headings and times that account for forecast wind and route changes.',
                keyTerms: ['wind correction angle', 'groundspeed', 'true heading', 'estimated time en route', 'nav log']
            },
            {
                mainSubject: 'Cross-country flight planning flow',
                phakTopic: 'Integrated route, weather, performance, and fuel planning',
                jeppTopic: 'Putting the full cross-country plan together',
                objective: 'Combine charts, performance, weather, and navigation into one coherent trip plan.',
                keyTerms: ['route selection', 'fuel reserve', 'checkpoint timing', 'alternate plan', 'flight log']
            }
        ]
    },
    {
        name: 'Regulations, Aeromedical Factors, and Risk Management',
        weeks: [
            {
                mainSubject: 'Pilot regulations and certificates',
                phakTopic: 'Required documents, privileges, limitations, and currency basics',
                jeppTopic: 'Regulation study for the private pilot knowledge test',
                objective: 'Understand the regulations that control legal VFR flight and pilot qualifications.',
                keyTerms: ['ARROW', 'currency', 'endorsement', 'limitations', 'required documents']
            },
            {
                mainSubject: 'Operating rules and right-of-way',
                phakTopic: 'General operating and flight rules, altitudes, and right-of-way',
                jeppTopic: 'Applying operating rules in common VFR scenarios',
                objective: 'Know the rules that shape safe operating habits and conflict resolution in the air.',
                keyTerms: ['minimum safe altitude', 'right-of-way', 'VFR cruising altitude', 'careless operation', 'speed limit']
            },
            {
                mainSubject: 'Aeromedical factors',
                phakTopic: 'Hypoxia, spatial disorientation, fatigue, dehydration, and medication awareness',
                jeppTopic: 'Pilot physiology and self-assessment',
                objective: 'Identify the physical and mental factors that quietly degrade pilot performance.',
                keyTerms: ['hypoxia', 'hyperventilation', 'ear block', 'fatigue', 'IMSAFE']
            },
            {
                mainSubject: 'Risk management and ADM',
                phakTopic: 'Aeronautical decision making, PAVE, and risk assessment tools',
                jeppTopic: 'Personal minimums and structured decision processes',
                objective: 'Use a repeatable process to identify, assess, and manage flight risk.',
                keyTerms: ['PAVE', '3P model', 'ADM', 'personal minimums', 'hazard']
            },
            {
                mainSubject: 'Single-pilot resource management',
                phakTopic: 'Task management, automation management, and workload control',
                jeppTopic: 'Cockpit resource management for one pilot',
                objective: 'Manage attention, workload, and distractions before they become unsafe.',
                keyTerms: ['SRM', 'automation', 'workload', 'task saturation', 'sterile cockpit']
            },
            {
                mainSubject: 'Regulation and risk review',
                phakTopic: 'Integrated review of rules, physiology, and pilot judgment',
                jeppTopic: 'Knowledge test review for legal and safe decision making',
                objective: 'Tighten up any gaps in rules, personal readiness, or risk management logic.',
                keyTerms: ['compliance', 'self-brief', 'go/no-go', 'mitigation', 'safety margin']
            }
        ]
    },
    {
        name: 'Cross-Country Planning and Scenario Practice',
        weeks: [
            {
                mainSubject: 'Local cross-country planning',
                phakTopic: 'Short VFR trip planning with route, fuel, and weather checks',
                jeppTopic: 'Building a realistic local cross-country plan',
                objective: 'Apply route, weather, and performance planning to a manageable local trip.',
                keyTerms: ['short cross-country', 'checkpoint', 'fuel stop', 'route review', 'terrain scan']
            },
            {
                mainSubject: 'Longer-route scenario building',
                phakTopic: 'Extended VFR planning, alternates, and workload pacing',
                jeppTopic: 'Planning for complexity over distance',
                objective: 'Plan for workload, changing weather, and alternate decisions on a longer trip.',
                keyTerms: ['alternate airport', 'decision point', 'fuel planning', 'diversion', 'time management']
            },
            {
                mainSubject: 'Weather and airspace tradeoffs',
                phakTopic: 'Scenario-based route changes for weather and airspace constraints',
                jeppTopic: 'Evaluating reroutes and staying ahead of the airplane',
                objective: 'Compare route options when weather and airspace pressures conflict.',
                keyTerms: ['reroute', 'airspace avoidance', 'weather deviation', 'buffer', 'workload']
            },
            {
                mainSubject: 'Diversions and abnormal planning',
                phakTopic: 'In-flight diversion logic and abnormal planning scenarios',
                jeppTopic: 'Decision making during off-nominal cross-country flights',
                objective: 'Practice the thought process for route changes, delays, and abnormal events.',
                keyTerms: ['diversion', 'nearest airport', 'abnormal', 'contingency', 'decision trigger']
            }
        ]
    },
    {
        name: 'Full Review and Weak-Area Remediation',
        weeks: [
            {
                mainSubject: 'Core subject review: aerodynamics and systems',
                phakTopic: 'Targeted review of foundational airplane knowledge',
                jeppTopic: 'Closing weak points in systems and flight principles',
                objective: 'Reinforce high-value fundamentals that support every later exam question.',
                keyTerms: ['foundation', 'systems review', 'stall logic', 'instrument support', 'knowledge gap']
            },
            {
                mainSubject: 'Core subject review: weather and performance',
                phakTopic: 'Targeted review of weather interpretation and aircraft performance',
                jeppTopic: 'Weak-area repair for forecasting and planning problems',
                objective: 'Tighten the subjects that most often drive missed written-exam questions.',
                keyTerms: ['forecast', 'performance margin', 'density altitude', 'ceiling', 'remediation']
            },
            {
                mainSubject: 'Core subject review: regulations and navigation',
                phakTopic: 'Targeted review of operating rules, charts, and planning logic',
                jeppTopic: 'Regulatory and navigation recap',
                objective: 'Bring rules and route-planning accuracy back to a confident level.',
                keyTerms: ['airspace rule', 'chart reading', 'nav log', 'currency', 'route compliance']
            },
            {
                mainSubject: 'Weakest subject sprint',
                phakTopic: 'Focused review of lowest-scoring exam domain',
                jeppTopic: 'Personal weak-area recovery week',
                objective: 'Spend one week attacking the weakest subject shown by your quiz history.',
                keyTerms: ['weak area', 'error pattern', 'repetition', 'flashcards', 'confidence rebuild']
            }
        ]
    },
    {
        name: 'Practice Exams and FAA Written Readiness',
        weeks: [
            {
                mainSubject: 'Timed practice exam one',
                phakTopic: 'Full-spectrum knowledge test review under time pressure',
                jeppTopic: 'Practice exam strategy and post-test analysis',
                objective: 'Take a realistic practice exam and study the reasons behind each miss.',
                keyTerms: ['timed exam', 'post-test review', 'accuracy trend', 'weak domain', 'time management']
            },
            {
                mainSubject: 'Timed practice exam two and final tuning',
                phakTopic: 'Final review and FAA written readiness decision',
                jeppTopic: 'Exam confidence, pacing, and last-gap cleanup',
                objective: 'Confirm exam readiness with a second full practice test and focused review.',
                keyTerms: ['readiness', 'consistency', 'confidence', 'final review', 'exam plan']
            }
        ]
    }
];

const questionBlueprints = [
    {
        subject: 'Pilot Certification',
        sourceTopic: 'PHAK pilot certification',
        questions: [
            { difficulty: 'easy', question: 'Which item is primarily used to record flight training endorsements and aeronautical experience?', choices: ['Pilot logbook', 'Sectional chart', 'Weather briefing', 'Airport diagram'], correctAnswer: 0, explanation: 'A pilot logbook is where training, endorsements, and experience are recorded.' },
            { difficulty: 'easy', question: 'Why should a student pilot understand certificate privileges before training begins?', choices: ['To know what operations are allowed at each training stage', 'To reduce aircraft maintenance costs', 'To avoid reading the FAR/AIM', 'To replace dual instruction with self-study'], correctAnswer: 0, explanation: 'Privileges and limitations shape what a pilot may legally do at each stage of training.' },
            { difficulty: 'medium', question: 'What is the best reason to review the Airman Certification Standards while studying?', choices: ['It shows how knowledge and skill areas are organized for evaluation', 'It replaces the need for weather study', 'It gives the exact written test questions', 'It removes the need for instructor feedback'], correctAnswer: 0, explanation: 'The ACS organizes what the FAA expects a pilot to know, consider, and do.' },
            { difficulty: 'medium', question: 'A student pilot wants to stay on track during a long self-study period. What is the most useful habit?', choices: ['Keeping a repeatable weekly study routine', 'Skipping weak subjects until later', 'Studying only when motivation feels high', 'Changing books every month'], correctAnswer: 0, explanation: 'A repeatable routine produces steady progress and reduces decision fatigue.' },
            { difficulty: 'easy', question: 'Which document normally ties a pilot’s training to an instructor’s approval for specific solo activities?', choices: ['An endorsement', 'A boarding pass', 'A squawk code', 'A TAF'], correctAnswer: 0, explanation: 'Endorsements document instructor authorization for specific training milestones.' },
            { difficulty: 'medium', question: 'Why is it useful to study both the PHAK and a training manual on the same subject?', choices: ['One builds FAA foundation while the other adds practical training context', 'It guarantees a perfect written score', 'It replaces any need for review quizzes', 'It eliminates variation between aircraft types'], correctAnswer: 0, explanation: 'Using both sources helps connect FAA concepts to practical cockpit application.' }
        ]
    },
    {
        subject: 'Aerodynamics',
        sourceTopic: 'PHAK aerodynamics',
        questions: [
            { difficulty: 'easy', question: 'A stall occurs when an airplane wing exceeds what condition?', choices: ['Its critical angle of attack', 'Its maximum flap setting', 'Its redline airspeed', 'Its maximum bank angle'], correctAnswer: 0, explanation: 'A stall is caused by exceeding the critical angle of attack, not by a specific airspeed alone.' },
            { difficulty: 'medium', question: 'Why does induced drag usually increase when an airplane flies slower at a constant weight?', choices: ['The wing needs a higher angle of attack to make enough lift', 'The propeller stops producing thrust', 'The airplane enters uncontrolled flight', 'The static port senses lower pressure'], correctAnswer: 0, explanation: 'At slower speeds the wing must work harder, usually raising angle of attack and induced drag.' },
            { difficulty: 'medium', question: 'What is the main purpose of the horizontal stabilizer in normal flight?', choices: ['To help maintain longitudinal stability', 'To provide engine cooling', 'To increase fuel flow', 'To reduce magnetic variation'], correctAnswer: 0, explanation: 'The horizontal stabilizer supports pitch balance and longitudinal stability.' },
            { difficulty: 'easy', question: 'Which force acts opposite the airplane’s motion through the air?', choices: ['Drag', 'Lift', 'Weight', 'Thrust'], correctAnswer: 0, explanation: 'Drag opposes motion, while thrust works forward.' },
            { difficulty: 'medium', question: 'Why can coordinated rudder input matter during a turn?', choices: ['It helps manage adverse yaw and keeps the airplane aerodynamically balanced', 'It lowers the stall speed to zero', 'It changes the airplane category', 'It turns the altimeter into a heading reference'], correctAnswer: 0, explanation: 'Rudder helps counter adverse yaw and maintain coordinated flight.' },
            { difficulty: 'hard', question: 'An aft center of gravity tends to change stall and stability characteristics in what way?', choices: ['It can reduce longitudinal stability and make stall recovery less forgiving', 'It always improves climb performance with no penalty', 'It prevents spins regardless of pilot input', 'It guarantees lower landing distance'], correctAnswer: 0, explanation: 'An aft CG often reduces stability and can make recovery from stalls more difficult.' }
        ]
    },
    {
        subject: 'Aircraft Systems',
        sourceTopic: 'PHAK aircraft systems',
        questions: [
            { difficulty: 'easy', question: 'What is the primary job of the alternator in a typical training airplane?', choices: ['To supply electrical power and recharge the battery during flight', 'To measure fuel quantity', 'To cool the brakes', 'To move the flaps directly'], correctAnswer: 0, explanation: 'The alternator powers electrical equipment and replenishes the battery while the engine runs.' },
            { difficulty: 'medium', question: 'Why are magnetos valuable in piston aircraft ignition systems?', choices: ['They allow spark generation without depending on the battery', 'They prevent any engine roughness', 'They replace the fuel pump', 'They eliminate the need for spark plugs'], correctAnswer: 0, explanation: 'Magnetos generate ignition spark independently, which supports engine reliability.' },
            { difficulty: 'medium', question: 'A popped circuit breaker should generally be treated how during flight?', choices: ['As a sign to troubleshoot carefully rather than repeatedly forcing it back in', 'As normal whenever lights are on', 'As proof the battery is overcharged', 'As a substitute for checklist use'], correctAnswer: 0, explanation: 'A tripped breaker may indicate an electrical fault, so repeated resets can worsen the problem.' },
            { difficulty: 'easy', question: 'Why is carburetor heat used in many training airplanes?', choices: ['To reduce or remove ice forming in the carburetor throat', 'To improve transponder range', 'To pressurize the fuel tanks', 'To lower oil temperature instantly'], correctAnswer: 0, explanation: 'Carburetor heat helps melt ice that may disrupt the fuel-air mixture.' },
            { difficulty: 'medium', question: 'What can low oil pressure indicate in flight?', choices: ['A potentially serious lubrication problem requiring prompt attention', 'A normal sign of high power', 'That the flaps are down', 'That the compass needs adjustment'], correctAnswer: 0, explanation: 'Low oil pressure can signal loss of lubrication and should be treated seriously.' },
            { difficulty: 'medium', question: 'Why is understanding the fuel selector important during preflight and abnormal situations?', choices: ['Because incorrect fuel feed selection can interrupt engine operation', 'Because it sets the altimeter automatically', 'Because it changes airport elevation', 'Because it disables the primer'], correctAnswer: 0, explanation: 'Selecting the proper fuel source is essential for consistent engine operation.' }
        ]
    },
    {
        subject: 'Flight Instruments',
        sourceTopic: 'PHAK flight instruments',
        questions: [
            { difficulty: 'easy', question: 'Which instrument displays changes in altitude based on static pressure trends rather than immediate true motion?', choices: ['Vertical speed indicator', 'Airspeed indicator', 'Magnetic compass', 'Tachometer'], correctAnswer: 0, explanation: 'The VSI senses rate of pressure change, so it reflects vertical trend rather than direct motion.' },
            { difficulty: 'easy', question: 'Which instrument uses both pitot and static pressure?', choices: ['Airspeed indicator', 'Altimeter', 'Turn coordinator', 'Heading indicator'], correctAnswer: 0, explanation: 'The airspeed indicator compares pitot pressure to static pressure.' },
            { difficulty: 'medium', question: 'Why does an altimeter need the correct setting before takeoff?', choices: ['So indicated altitude reflects local pressure conditions more accurately', 'So fuel burn decreases', 'So the transponder enters standby', 'So the engine reaches idle cutoff'], correctAnswer: 0, explanation: 'Setting the correct pressure reference helps the altimeter indicate local elevation correctly.' },
            { difficulty: 'medium', question: 'What is a common weakness of a heading indicator compared with a magnetic compass?', choices: ['It can drift and needs periodic realignment', 'It cannot be read in daylight', 'It only works in icing conditions', 'It measures airspeed instead of heading'], correctAnswer: 0, explanation: 'Heading indicators can drift over time and should be aligned with the magnetic compass.' },
            { difficulty: 'hard', question: 'A blocked pitot tube with an open drain hole will most directly affect which instrument?', choices: ['Airspeed indicator', 'Altimeter', 'Attitude indicator', 'Turn coordinator'], correctAnswer: 0, explanation: 'Airspeed relies on pitot pressure; pitot blockage most directly corrupts that indication.' },
            { difficulty: 'medium', question: 'Why is an instrument cross-check valuable even in visual conditions?', choices: ['It helps catch misleading single-instrument indications before they create confusion', 'It replaces outside scanning completely', 'It prevents turbulence', 'It removes all compass errors'], correctAnswer: 0, explanation: 'Cross-checking helps detect abnormal indications and supports situational awareness.' }
        ]
    },
    {
        subject: 'Weight and Balance',
        sourceTopic: 'PHAK weight and balance',
        questions: [
            { difficulty: 'easy', question: 'What does the term arm describe in weight and balance work?', choices: ['The distance from the datum to the item', 'The total fuel capacity', 'The climb gradient', 'The stall margin'], correctAnswer: 0, explanation: 'Arm is the distance from the reference datum to the item being measured.' },
            { difficulty: 'easy', question: 'Why is an aft center of gravity a concern?', choices: ['It can reduce stability and make recovery from stalls more difficult', 'It always shortens takeoff distance safely', 'It guarantees better visibility', 'It eliminates the need for trim'], correctAnswer: 0, explanation: 'Aft CG reduces pitch stability and can make recovery more demanding.' },
            { difficulty: 'medium', question: 'What is a moment in loading calculations?', choices: ['Weight multiplied by its arm', 'Fuel divided by time', 'Airspeed minus altitude', 'Pressure plus temperature'], correctAnswer: 0, explanation: 'Moment is the turning effect of weight at a given arm.' },
            { difficulty: 'medium', question: 'Why should fuel burn be considered during some loading scenarios?', choices: ['Because center of gravity can shift as fuel is consumed', 'Because fuel always moves the datum', 'Because it resets the altimeter', 'Because it changes runway slope'], correctAnswer: 0, explanation: 'Fuel burn changes both weight and balance over the course of flight.' },
            { difficulty: 'easy', question: 'What is useful load?', choices: ['The weight available for pilots, passengers, baggage, and usable fuel', 'The maximum weight of the empty airplane', 'The runway length needed for landing', 'The pressure altitude at cruise'], correctAnswer: 0, explanation: 'Useful load is what can be added to the empty aircraft within limits.' },
            { difficulty: 'hard', question: 'What is the best response if a planned loading scenario falls just outside the approved envelope?', choices: ['Adjust passengers, baggage, or fuel until the loading is within limits', 'Accept the condition for short flights only', 'Use more back pressure on takeoff', 'Rely on cooler weather to fix it'], correctAnswer: 0, explanation: 'Loading must be brought within the approved envelope before flight.' }
        ]
    },
    {
        subject: 'Aircraft Performance',
        sourceTopic: 'PHAK aircraft performance',
        questions: [
            { difficulty: 'easy', question: 'Why does high density altitude usually reduce airplane performance?', choices: ['The thinner air decreases engine, propeller, and wing effectiveness', 'It makes the airplane heavier', 'It lowers stall speed to zero', 'It strengthens the battery'], correctAnswer: 0, explanation: 'Thin air hurts power production, thrust, and lift, reducing performance.' },
            { difficulty: 'medium', question: 'When using a takeoff performance chart, what is the main goal?', choices: ['To estimate runway distance and climb capability for current conditions', 'To find the best radio frequency', 'To compute center of pressure', 'To decode a TAF'], correctAnswer: 0, explanation: 'Performance charts help predict runway and climb requirements for the actual conditions.' },
            { difficulty: 'medium', question: 'How does a headwind typically affect takeoff distance?', choices: ['It tends to reduce the ground roll needed', 'It always doubles the takeoff run', 'It has no effect', 'It increases density altitude'], correctAnswer: 0, explanation: 'A headwind lowers groundspeed needed for liftoff, usually reducing takeoff distance.' },
            { difficulty: 'easy', question: 'Why should performance planning use conservative margins instead of exact chart numbers alone?', choices: ['Real-world conditions and pilot technique can differ from ideal test conditions', 'Charts are only for IFR aircraft', 'Margins are required only above 10,000 feet', 'Charts are optional in training airplanes'], correctAnswer: 0, explanation: 'Conservative margins account for imperfect technique and non-ideal field conditions.' },
            { difficulty: 'hard', question: 'If runway slope, grass surface, and high temperature all apply, how should a pilot think about performance?', choices: ['As a combined penalty that may significantly increase takeoff or landing distance', 'As minor factors that offset one another', 'As issues only for multiengine aircraft', 'As relevant only after liftoff'], correctAnswer: 0, explanation: 'Multiple adverse factors stack together and can materially degrade performance.' },
            { difficulty: 'medium', question: 'Why is climb performance important immediately after takeoff?', choices: ['It affects obstacle clearance and options if the airplane cannot outclimb terrain or structures', 'It controls transponder code selection', 'It replaces the need for weight and balance', 'It changes traffic pattern direction'], correctAnswer: 0, explanation: 'Climb performance is critical for safe obstacle clearance and departure planning.' }
        ]
    },
    {
        subject: 'Weather Theory',
        sourceTopic: 'PHAK weather theory',
        questions: [
            { difficulty: 'easy', question: 'What does dew point describe?', choices: ['The temperature at which air becomes saturated', 'The altitude of the freezing level', 'The speed of a cold front', 'The strength of a magnetic field'], correctAnswer: 0, explanation: 'Dew point is the temperature where air reaches saturation.' },
            { difficulty: 'medium', question: 'Why does unstable air often matter to pilots?', choices: ['It supports stronger vertical motion, turbulence, and convective cloud growth', 'It guarantees smooth air', 'It prevents frontal weather', 'It lowers wind speed everywhere'], correctAnswer: 0, explanation: 'Unstable air favors vertical development, turbulence, and potentially hazardous weather.' },
            { difficulty: 'easy', question: 'A rapid drop in pressure is often a clue that what may be approaching?', choices: ['A weather system or frontal change', 'A tailwheel endorsement', 'A new runway number', 'A stronger vacuum pump'], correctAnswer: 0, explanation: 'Falling pressure often signals changing weather and the approach of a system.' },
            { difficulty: 'medium', question: 'Why can a large temperature-dew point spread be operationally useful?', choices: ['It usually suggests better near-term fog resistance than a narrow spread', 'It guarantees unlimited visibility for days', 'It predicts tailwinds aloft', 'It removes icing risk completely'], correctAnswer: 0, explanation: 'A wider spread means the air is less close to saturation, making fog less immediate.' },
            { difficulty: 'hard', question: 'Which weather setup most strongly supports thunderstorm development?', choices: ['Warm, moist, unstable air with a lifting trigger', 'Cold, dry, stable air with no lift', 'Calm winter high pressure only', 'A shallow fog layer at sunrise'], correctAnswer: 0, explanation: 'Thunderstorms need moisture, instability, and a trigger to lift the air.' },
            { difficulty: 'medium', question: 'Why is fog especially concerning for VFR operations?', choices: ['It can sharply reduce both visibility and ceiling near the surface', 'It raises the service ceiling of the airplane', 'It improves visual checkpoints', 'It reduces runway contamination'], correctAnswer: 0, explanation: 'Fog can quickly make VFR conditions unusable by lowering visibility and cloud clearance.' }
        ]
    },
    {
        subject: 'METARs and TAFs',
        sourceTopic: 'PHAK weather reports and forecasts',
        questions: [
            { difficulty: 'easy', question: 'What is the main difference between a METAR and a TAF?', choices: ['A METAR reports observed conditions while a TAF forecasts expected conditions', 'A METAR is for military airports only', 'A TAF is always more current than a METAR', 'A METAR includes no wind information'], correctAnswer: 0, explanation: 'METARs are observations; TAFs are forecasts.' },
            { difficulty: 'medium', question: 'Why should a pilot compare a METAR with a recent TAF?', choices: ['To see whether observed conditions are tracking with the forecast trend', 'To change the airplane category', 'To compute center of gravity', 'To select a transponder code'], correctAnswer: 0, explanation: 'Comparing both products helps identify whether conditions are better or worse than expected.' },
            { difficulty: 'easy', question: 'What does a low ceiling in a METAR primarily affect?', choices: ['Available vertical room for VFR flight', 'Fuel octane requirements', 'Compass deviation', 'Tire pressure'], correctAnswer: 0, explanation: 'Ceiling directly affects VFR cloud clearance and maneuvering room.' },
            { difficulty: 'medium', question: 'If a TAF shows worsening visibility later in the evening, what is the best study takeaway?', choices: ['Forecast timing matters when evaluating go or delay decisions', 'Visibility only matters to instrument pilots', 'TAFs do not apply to local flights', 'Evening forecasts replace all surface observations'], correctAnswer: 0, explanation: 'TAF timing helps a pilot decide whether conditions may degrade during the planned flight.' },
            { difficulty: 'hard', question: 'Why are trend groups in weather products worth attention?', choices: ['They can highlight temporary improvements or deteriorations that affect a departure window', 'They replace the need to check winds aloft', 'They are only used by dispatchers', 'They describe fuel burn'], correctAnswer: 0, explanation: 'Temporary changes may materially affect the safest time to launch or arrive.' },
            { difficulty: 'easy', question: 'What should a pilot do if weather text products are confusing?', choices: ['Slow down and translate each element into operational meaning before deciding', 'Ignore the report and launch locally', 'Use only the color on an app map', 'Assume conditions are fine if winds are light'], correctAnswer: 0, explanation: 'Weather products are useful only when translated into operational consequences.' }
        ]
    },
    {
        subject: 'Airspace',
        sourceTopic: 'PHAK airspace',
        questions: [
            { difficulty: 'easy', question: 'Why is knowing your airspace class important before departure?', choices: ['It determines communication, equipment, and weather minimum expectations', 'It sets the airplane empty weight', 'It changes fuel grade', 'It selects runway lighting automatically'], correctAnswer: 0, explanation: 'Different airspace classes come with different communication and operating requirements.' },
            { difficulty: 'medium', question: 'What is the practical risk of accidentally entering controlled airspace without preparation?', choices: ['You may violate communication or clearance requirements and increase traffic conflict risk', 'You automatically become IFR', 'Your magnetic compass stops working', 'The airplane climbs better'], correctAnswer: 0, explanation: 'Unplanned airspace entry can create both legal and safety issues.' },
            { difficulty: 'easy', question: 'Why are sectional chart boundaries important?', choices: ['They show where operating rules and service expectations may change', 'They give oil pressure limits', 'They replace airport diagrams', 'They are only for helicopter pilots'], correctAnswer: 0, explanation: 'Airspace boundaries define who to talk to and which rules apply.' },
            { difficulty: 'medium', question: 'What is a smart habit near special-use airspace?', choices: ['Review operating times and route options before launch', 'Assume entry is always allowed below pattern altitude', 'Ignore it if visibility is good', 'Use it as a shortcut without checking'], correctAnswer: 0, explanation: 'Special-use airspace may be active and should be evaluated before departure.' },
            { difficulty: 'hard', question: 'Why can a VFR pilot benefit from talking to ATC even outside required airspace?', choices: ['Radar advisories can improve traffic awareness and reduce workload', 'ATC becomes responsible for weather decisions', 'It removes the need for navigation planning', 'It permits entry into any restricted area'], correctAnswer: 0, explanation: 'Radar services can improve awareness, though the pilot still retains primary responsibility.' },
            { difficulty: 'medium', question: 'Which study habit best helps airspace retention?', choices: ['Matching each airspace type with entry, visibility, and communication rules', 'Memorizing only color shading', 'Skipping chart work until flight training starts', 'Learning airport elevation instead'], correctAnswer: 0, explanation: 'Connecting the chart depiction to the operating rule is what makes the knowledge useful.' }
        ]
    },
    {
        subject: 'Airports',
        sourceTopic: 'PHAK airport operations',
        questions: [
            { difficulty: 'easy', question: 'What is the purpose of hold short markings?', choices: ['To show where an aircraft must stop before entering a protected runway area', 'To identify the ramp fuel grade', 'To mark helicopter-only taxi lanes', 'To display wind direction'], correctAnswer: 0, explanation: 'Hold short markings protect the runway environment from unauthorized entry.' },
            { difficulty: 'easy', question: 'Why are runway numbers useful?', choices: ['They approximate the runway magnetic heading', 'They show runway length in hundreds of feet', 'They indicate traffic pattern altitude', 'They label the nearest VOR radial'], correctAnswer: 0, explanation: 'Runway numbers reflect the runway’s magnetic alignment rounded to the nearest ten degrees.' },
            { difficulty: 'medium', question: 'What is the main value of a PAPI or VASI system?', choices: ['It gives visual glidepath guidance on final approach', 'It replaces crosswind correction', 'It indicates oil temperature', 'It marks taxi routes'], correctAnswer: 0, explanation: 'Visual glidepath systems help pilots maintain a proper approach angle.' },
            { difficulty: 'medium', question: 'Why should a pilot brief an airport diagram before taxi?', choices: ['It reduces the chance of confusion or runway incursion on the ground', 'It guarantees a tailwind departure', 'It increases useful load', 'It sets the transponder code'], correctAnswer: 0, explanation: 'Taxi planning helps the pilot stay ahead of the airplane on the surface.' },
            { difficulty: 'hard', question: 'At a non-towered airport, what makes a standard traffic pattern valuable?', choices: ['It improves predictability for all aircraft sharing the airport', 'It eliminates the need for visual scanning', 'It allows opposite-direction landings anytime', 'It makes CTAF calls optional'], correctAnswer: 0, explanation: 'A standard pattern helps everyone anticipate where traffic will be.' },
            { difficulty: 'medium', question: 'Why do lighting systems matter during dusk or night operations?', choices: ['They help pilots identify runway edges, alignment, and safe movement areas', 'They reduce stall speed', 'They increase engine output', 'They broadcast ATIS automatically'], correctAnswer: 0, explanation: 'Airport lighting supports orientation and safe movement when outside cues are reduced.' }
        ]
    },
    {
        subject: 'ATC Communication',
        sourceTopic: 'PHAK communication procedures',
        questions: [
            { difficulty: 'easy', question: 'What makes a good initial radio call?', choices: ['Who you are calling, who you are, where you are, and what you want', 'Only the aircraft color and passenger count', 'The weather report and fuel burn', 'A long explanation before identifying the station'], correctAnswer: 0, explanation: 'A clear structure helps the listener understand the call quickly.' },
            { difficulty: 'medium', question: 'Why are concise readbacks important?', choices: ['They confirm critical instructions without clogging the frequency', 'They are required only at uncontrolled airports', 'They replace checklist use', 'They remove the need for listening'], correctAnswer: 0, explanation: 'Clear readbacks reduce misunderstanding and keep radio traffic efficient.' },
            { difficulty: 'easy', question: 'What is the value of listening before transmitting on CTAF?', choices: ['It helps you build traffic awareness and avoid stepping on other calls', 'It improves alternator output', 'It updates your compass automatically', 'It changes airport elevation'], correctAnswer: 0, explanation: 'Listening first gives a picture of other traffic and reduces blocked transmissions.' },
            { difficulty: 'medium', question: 'Why can over-talking on the radio be a problem?', choices: ['It increases cockpit workload and can bury important information', 'It guarantees ATC priority', 'It improves runway lighting', 'It lowers landing distance'], correctAnswer: 0, explanation: 'Extra words add workload and can obscure essential information.' },
            { difficulty: 'hard', question: 'If a controller issues a clearance that seems unsafe or misunderstood, what is the best pilot response?', choices: ['Request clarification or advise unable before acting', 'Comply immediately and ask later', 'Ignore the clearance without speaking', 'Switch frequencies and continue'], correctAnswer: 0, explanation: 'Pilots should clarify or decline an unsafe instruction rather than guessing.' },
            { difficulty: 'medium', question: 'Why is standard phraseology helpful during training?', choices: ['It creates predictable communication patterns that reduce ambiguity', 'It eliminates the need for radios at towered airports', 'It replaces route planning', 'It removes all crosswind risk'], correctAnswer: 0, explanation: 'Standard phraseology improves clarity and reduces the chance of misinterpretation.' }
        ]
    },
    {
        subject: 'Navigation',
        sourceTopic: 'PHAK navigation',
        questions: [
            { difficulty: 'easy', question: 'What is pilotage?', choices: ['Navigating by reference to visible landmarks', 'Tracking by only the altimeter', 'Flying solely by radio without a chart', 'Using weather radar for routing'], correctAnswer: 0, explanation: 'Pilotage uses visible features such as rivers, highways, and towns.' },
            { difficulty: 'medium', question: 'Why is dead reckoning still worth learning in a GPS world?', choices: ['It helps a pilot reason through route progress if electronics fail or become distracting', 'It replaces weather planning', 'It is required only at night', 'It guarantees no heading errors'], correctAnswer: 0, explanation: 'Dead reckoning builds core route awareness and provides a backup method.' },
            { difficulty: 'medium', question: 'What is the purpose of a wind correction angle?', choices: ['To offset drift so the airplane tracks the intended course over the ground', 'To reduce fuel octane needs', 'To change the magnetic variation', 'To lower pattern altitude'], correctAnswer: 0, explanation: 'Wind correction keeps the aircraft on course despite crosswind drift.' },
            { difficulty: 'easy', question: 'Why are checkpoints useful on a VFR route?', choices: ['They let the pilot confirm location and timing along the way', 'They replace the need for fuel planning', 'They determine passenger weight', 'They turn a chart into a forecast'], correctAnswer: 0, explanation: 'Checkpoints verify that the flight is progressing as planned.' },
            { difficulty: 'hard', question: 'What is the best response if groundspeed appears lower than planned en route?', choices: ['Recompute arrival time and fuel outlook, then consider alternates or changes early', 'Ignore it unless the engine sounds rough', 'Assume the headwind will vanish', 'Climb indefinitely until it improves'], correctAnswer: 0, explanation: 'Updating time and fuel expectations early preserves options.' },
            { difficulty: 'medium', question: 'Why should heading, time, and fuel all be reviewed together during cross-country planning?', choices: ['They interact and reveal whether the route is both practical and safe', 'Only heading matters if landmarks are visible', 'Fuel planning belongs only to night flights', 'Time has no role in VFR planning'], correctAnswer: 0, explanation: 'Cross-country planning works best when navigation, timing, and fuel are treated as one system.' }
        ]
    },
    {
        subject: 'Sectional Charts',
        sourceTopic: 'PHAK charts and publications',
        questions: [
            { difficulty: 'easy', question: 'Why are maximum elevation figures useful on a sectional chart?', choices: ['They quickly show the highest known terrain or obstacle in a grid area', 'They identify the nearest fuel pump', 'They report ceiling and visibility', 'They replace runway length data'], correctAnswer: 0, explanation: 'MEFs provide a quick terrain/obstruction awareness reference in each chart quadrant.' },
            { difficulty: 'medium', question: 'What is the main value of chart symbology study?', choices: ['It turns chart markings into usable terrain, airport, and airspace awareness', 'It improves spark plug life', 'It lowers aircraft empty weight', 'It replaces NOTAM checks'], correctAnswer: 0, explanation: 'Symbols matter because they communicate real operational information.' },
            { difficulty: 'medium', question: 'Why is chart scale important during route planning?', choices: ['It affects distance interpretation and checkpoint spacing', 'It changes magnetic deviation', 'It controls engine cooling', 'It sets the altimeter setting'], correctAnswer: 0, explanation: 'Scale determines how accurately distance and spacing are read on the chart.' },
            { difficulty: 'easy', question: 'What should a pilot do when a chart symbol is unfamiliar?', choices: ['Use the legend or chart supplement rather than guessing', 'Ignore it if outside the route line', 'Assume it marks a private runway', 'Treat it as weather information'], correctAnswer: 0, explanation: 'Unknown symbols should be verified, not guessed at.' },
            { difficulty: 'hard', question: 'Why can obstacle symbols matter even in good VFR visibility?', choices: ['They reveal hazards that may still be hard to detect visually until too late', 'They only matter to helicopters', 'They apply only above Class A airspace', 'They affect fuel quantity only'], correctAnswer: 0, explanation: 'Obstacles can remain difficult to see, especially with haze, lighting angle, or distraction.' },
            { difficulty: 'medium', question: 'What is a good sectional study method?', choices: ['Trace routes while explaining each symbol and airspace transition out loud', 'Memorize only airport names', 'Study the cover page only', 'Ignore terrain if flying locally'], correctAnswer: 0, explanation: 'Explaining a route forces the pilot to connect symbols to actual decisions.' }
        ]
    },
    {
        subject: 'Regulations',
        sourceTopic: 'PHAK regulations',
        questions: [
            { difficulty: 'easy', question: 'Why should a pilot know the documents required aboard the airplane?', choices: ['Because legal operation depends on both pilot and aircraft document compliance', 'Because they increase cruise speed', 'Because they replace preflight inspection', 'Because they guarantee maintenance quality'], correctAnswer: 0, explanation: 'Required documents are part of legal aircraft operation.' },
            { difficulty: 'medium', question: 'What is the practical value of understanding right-of-way rules?', choices: ['They help pilots resolve traffic conflicts predictably and safely', 'They let a faster airplane ignore pattern traffic', 'They apply only in instrument weather', 'They are only for checkride questions'], correctAnswer: 0, explanation: 'Right-of-way rules reduce uncertainty when traffic conflicts arise.' },
            { difficulty: 'easy', question: 'Why do VFR weather minimums matter?', choices: ['They define the legal and safe visibility/cloud clearance needed for operation', 'They determine useful load', 'They set oil temperature limits', 'They replace personal minimums'], correctAnswer: 0, explanation: 'Weather minimums define what conditions are acceptable for the airspace and operation.' },
            { difficulty: 'medium', question: 'What is the purpose of flight review and currency concepts?', choices: ['To help ensure pilots remain legally current and reasonably proficient', 'To authorize any aircraft maintenance', 'To replace knowledge tests permanently', 'To select runway lighting intensity'], correctAnswer: 0, explanation: 'Currency requirements support ongoing legal and practical readiness.' },
            { difficulty: 'hard', question: 'Why is "legal" not always the same as "smart" in flight planning?', choices: ['Conditions can meet minimum rules while still exceeding a pilot’s skill or comfort margin', 'Legal flight always means zero risk', 'Smart choices are only for commercial pilots', 'Regulations require maximum risk tolerance'], correctAnswer: 0, explanation: 'Personal proficiency and safety margins often call for more conservative choices than the legal minimum.' },
            { difficulty: 'medium', question: 'How should regulation study be approached for retention?', choices: ['Connect each rule to a realistic operating scenario', 'Memorize numbers with no context', 'Study only the penalties for violations', 'Skip rules that seem rarely tested'], correctAnswer: 0, explanation: 'Scenario-based study helps a pilot remember how and when a rule applies.' }
        ]
    },
    {
        subject: 'Aeromedical Factors',
        sourceTopic: 'PHAK aeromedical factors',
        questions: [
            { difficulty: 'easy', question: 'What is the main danger of fatigue for pilots?', choices: ['It quietly degrades judgment, attention, and reaction time', 'It improves tunnel vision only', 'It increases fuel reserves', 'It guarantees stable weather decisions'], correctAnswer: 0, explanation: 'Fatigue can subtly but significantly reduce pilot performance.' },
            { difficulty: 'medium', question: 'Why is the IMSAFE checklist useful?', choices: ['It prompts an honest self-check before flight', 'It replaces weather planning', 'It records maintenance discrepancies', 'It sets the magnetic heading'], correctAnswer: 0, explanation: 'IMSAFE helps a pilot assess physical and mental fitness to fly.' },
            { difficulty: 'easy', question: 'What does hypoxia most directly affect?', choices: ['The body’s ability to deliver adequate oxygen to tissues', 'The airplane’s tire pressure', 'The color of runway lights', 'The amount of fuel in the tanks'], correctAnswer: 0, explanation: 'Hypoxia is about insufficient oxygen available to the body.' },
            { difficulty: 'medium', question: 'Why should pilots be cautious with over-the-counter medication?', choices: ['Even common medicines can affect alertness, judgment, or coordination', 'They always improve night vision', 'They eliminate motion sickness permanently', 'They replace hydration'], correctAnswer: 0, explanation: 'Medication side effects can make a pilot unfit or less safe to fly.' },
            { difficulty: 'hard', question: 'How can dehydration affect cockpit performance?', choices: ['It can worsen fatigue, concentration, and headache risk', 'It raises aircraft climb rate', 'It improves hearing under a headset', 'It lowers density altitude'], correctAnswer: 0, explanation: 'Dehydration contributes to poor concentration and physical discomfort.' },
            { difficulty: 'medium', question: 'Why is spatial disorientation important to study before formal training?', choices: ['It shows how easily the senses can mislead a pilot without a strong scan', 'It only occurs in aerobatics', 'It never affects VFR pilots', 'It is fixed by extra rudder'], correctAnswer: 0, explanation: 'A pilot’s senses can be unreliable, especially without good visual or instrument references.' }
        ]
    },
    {
        subject: 'Risk Management',
        sourceTopic: 'PHAK risk management',
        questions: [
            { difficulty: 'easy', question: 'What is the value of personal minimums?', choices: ['They add a buffer beyond legal limits based on the pilot’s experience and comfort', 'They replace all regulations', 'They lower fuel burn', 'They eliminate crosswind limits'], correctAnswer: 0, explanation: 'Personal minimums add a safety cushion that reflects real proficiency.' },
            { difficulty: 'medium', question: 'Why is the PAVE model helpful?', choices: ['It organizes risk factors into pilot, aircraft, environment, and external pressures', 'It predicts engine failures exactly', 'It replaces checklists', 'It applies only to instrument pilots'], correctAnswer: 0, explanation: 'PAVE gives a simple structure for identifying broad categories of risk.' },
            { difficulty: 'medium', question: 'What is a common effect of external pressure on decision making?', choices: ['It tempts pilots to continue with plans that deserve re-evaluation', 'It improves situational awareness automatically', 'It reduces weather complexity', 'It prevents fatigue'], correctAnswer: 0, explanation: 'Schedule pressure and expectations can bias a pilot toward poor decisions.' },
            { difficulty: 'easy', question: 'Why is an alternate plan useful before takeoff?', choices: ['It preserves options if weather, fuel, or workload does not unfold as expected', 'It locks the pilot into a longer route', 'It changes the aircraft category', 'It eliminates the need for ATC'], correctAnswer: 0, explanation: 'A backup plan helps the pilot adapt early instead of improvising late.' },
            { difficulty: 'hard', question: 'What is the best way to use a risk tool after hazards are identified?', choices: ['Decide whether to mitigate, delay, change the plan, or decline the flight', 'File it away after noting the score', 'Assume experience removes the hazard', 'Treat all risks as equal'], correctAnswer: 0, explanation: 'A risk tool should guide action, not just labeling.' },
            { difficulty: 'medium', question: 'Why is post-flight self-review a strong risk-management habit?', choices: ['It reveals patterns in judgment, preparation, and execution for future flights', 'It makes regulations optional', 'It replaces instructor feedback permanently', 'It changes chart symbols'], correctAnswer: 0, explanation: 'Reviewing decisions after a flight helps build better habits over time.' }
        ]
    },
    {
        subject: 'Cross-Country Planning',
        sourceTopic: 'PHAK cross-country planning',
        questions: [
            { difficulty: 'easy', question: 'What is the purpose of a nav log?', choices: ['To organize headings, checkpoints, times, and fuel information for a route', 'To store aircraft maintenance receipts', 'To decode METAR remarks only', 'To calculate center of gravity automatically'], correctAnswer: 0, explanation: 'A nav log keeps the route plan and en route checkpoints organized.' },
            { difficulty: 'medium', question: 'Why should fuel reserves be considered separately from expected en route burn?', choices: ['They protect the flight against delays, headwinds, and reroutes', 'They are used only in military operations', 'They replace alternate airports', 'They apply only after sunset'], correctAnswer: 0, explanation: 'Reserves create a safety margin beyond the nominal fuel plan.' },
            { difficulty: 'easy', question: 'What makes a checkpoint useful?', choices: ['It is easy to identify and appears at a sensible time interval on the route', 'It is the highest terrain point available', 'It changes with radio frequency selection', 'It always sits directly under class B airspace'], correctAnswer: 0, explanation: 'Good checkpoints are visible, distinct, and spaced well for progress tracking.' },
            { difficulty: 'medium', question: 'Why should a cross-country plan include weather decision points?', choices: ['They define when to reassess conditions before options narrow', 'They lock the pilot into continuing', 'They replace cloud clearance requirements', 'They only matter for night flights'], correctAnswer: 0, explanation: 'Decision points help a pilot reevaluate before fuel or route options shrink.' },
            { difficulty: 'hard', question: 'What is the best response if actual fuel burn is higher than planned early in the trip?', choices: ['Update the plan immediately and consider a fuel stop or route change', 'Continue and hope later winds help', 'Ignore it unless the engine sputters', 'Climb higher regardless of weather'], correctAnswer: 0, explanation: 'Early plan updates preserve options and reduce pressure later in the flight.' },
            { difficulty: 'medium', question: 'Why is terrain review part of route planning even in familiar areas?', choices: ['Conditions, route variations, and workload can make familiar terrain more hazardous than expected', 'Terrain matters only above 10,000 feet', 'Familiarity removes all risk', 'Terrain review changes wind direction'], correctAnswer: 0, explanation: 'Familiar routes still demand terrain awareness and respect for changing conditions.' }
        ]
    },
    {
        subject: 'Emergency Procedures',
        sourceTopic: 'PHAK emergency procedures',
        questions: [
            { difficulty: 'easy', question: 'Why are emergency checklists worth studying before flight training intensifies?', choices: ['They help a pilot respond faster and more calmly when workload spikes', 'They guarantee the engine keeps running', 'They replace instructor briefings', 'They eliminate the need for preflight'], correctAnswer: 0, explanation: 'Familiarity with emergency logic improves response under stress.' },
            { difficulty: 'medium', question: 'In an engine-failure scenario, why is maintaining aircraft control the first priority?', choices: ['Because no checklist matters if the airplane is not kept under control', 'Because ATC must always be called first', 'Because passengers should choose the landing site', 'Because restarting the engine always comes before attitude control'], correctAnswer: 0, explanation: 'Aircraft control comes before troubleshooting or communication.' },
            { difficulty: 'medium', question: 'What is the benefit of identifying landing options early during a local flight?', choices: ['It reduces decision delay if the engine or weather situation worsens', 'It increases cruise speed', 'It changes the empty weight', 'It removes the need for fuel planning'], correctAnswer: 0, explanation: 'Pre-identified options reduce stress and speed up decision making in an emergency.' },
            { difficulty: 'easy', question: 'Why is a checklist especially helpful during abnormal system indications?', choices: ['It provides an organized response when memory may be unreliable under stress', 'It replaces all aircraft knowledge', 'It guarantees no further damage', 'It is only useful in simulators'], correctAnswer: 0, explanation: 'Checklists help the pilot respond in a consistent and disciplined way.' },
            { difficulty: 'hard', question: 'What is the most practical reason to rehearse radio calls for emergencies?', choices: ['It makes communication more efficient when time and attention are limited', 'It removes the need to aviate first', 'It guarantees rescue services regardless of location', 'It replaces using the transponder'], correctAnswer: 0, explanation: 'Brief mental rehearsal reduces hesitation when communicating under pressure.' },
            { difficulty: 'medium', question: 'Why should emergency training include post-event review?', choices: ['It reveals where recognition, priorities, or checklist use can improve', 'It proves the event will not happen again', 'It lowers insurance automatically', 'It changes aircraft category'], correctAnswer: 0, explanation: 'Review turns an abnormal event into a learning opportunity.' }
        ]
    }
];

const ScheduleService = {
    _schedule: null,

    getSchedule() {
        if (this._schedule) {
            return this._schedule;
        }

        const schedule = [];
        let weekNumber = 1;

        phaseBlueprints.forEach((phase) => {
            phase.weeks.forEach((week) => {
                const summary = `${week.mainSubject} sets the tone for this phase with focused reading in ${week.phakTopic.toLowerCase()} and ${week.jeppTopic.toLowerCase()}.`;
                const weekPlan = {
                    weekNumber,
                    phaseName: phase.name,
                    mainSubject: week.mainSubject,
                    phakTopic: week.phakTopic,
                    jeppTopic: week.jeppTopic,
                    estimatedHours: 6,
                    objective: week.objective,
                    keyTerms: week.keyTerms,
                    summary,
                    dailyBreakdown: this.buildDailyBreakdown(week),
                    reviewQuestions: this.buildReviewQuestions(week)
                };

                schedule.push(weekPlan);
                weekNumber += 1;
            });
        });

        this._schedule = schedule;
        return schedule;
    },

    buildDailyBreakdown(week) {
        return [
            {
                day: 1,
                label: DAY_LABELS[0],
                topic: `Orientation to ${week.mainSubject}`,
                readingTask: `Read the PHAK section on ${week.phakTopic.toLowerCase()}.`,
                reviewTask: `Write three takeaways and one question about ${week.mainSubject.toLowerCase()}.`
            },
            {
                day: 2,
                label: DAY_LABELS[1],
                topic: `Jeppesen pass on ${week.mainSubject}`,
                readingTask: `Read the Jeppesen material for ${week.jeppTopic.toLowerCase()}.`,
                reviewTask: 'Build a one-page outline of the key ideas from both books.'
            },
            {
                day: 3,
                label: DAY_LABELS[2],
                topic: `Consolidate notes for ${week.mainSubject}`,
                readingTask: 'Review your notes and flashcards from the first two sessions.',
                reviewTask: `Define each key term in your own words: ${week.keyTerms.slice(0, 3).join(', ')}.`
            },
            {
                day: 4,
                label: DAY_LABELS[3],
                topic: `Apply ${week.mainSubject} to a scenario`,
                readingTask: `Revisit the most important paragraph from ${week.phakTopic.toLowerCase()}.`,
                reviewTask: `Describe how ${week.mainSubject.toLowerCase()} affects a real preflight or in-flight decision.`
            },
            {
                day: 5,
                label: DAY_LABELS[4],
                topic: `${week.mainSubject} practice questions`,
                readingTask: 'Skim your outline and weak notes before quizzing.',
                reviewTask: 'Complete at least 10 original practice questions and review every explanation.'
            },
            {
                day: 6,
                label: DAY_LABELS[5],
                topic: `Weak-spot repair for ${week.mainSubject}`,
                readingTask: 'Return to the sections that still feel fuzzy or error-prone.',
                reviewTask: `Summarize the week objective: ${week.objective}`
            },
            {
                day: 7,
                label: DAY_LABELS[6],
                topic: `Review and catch-up for ${week.mainSubject}`,
                readingTask: 'Use this day for catch-up reading, a light recap, or rest.',
                reviewTask: 'Rate your confidence and note what still needs a second pass.'
            }
        ];
    },

    buildReviewQuestions(week) {
        const [termA, termB, termC, termD, termE] = week.keyTerms;
        return [
            `How would you explain the central idea behind ${week.mainSubject.toLowerCase()}?`,
            `What is the most testable concept from ${week.phakTopic.toLowerCase()}?`,
            `What practical cockpit takeaway came from ${week.jeppTopic.toLowerCase()}?`,
            `Define ${termA} without using the book wording.`,
            `Define ${termB} and describe why it matters in private pilot training.`,
            `Define ${termC} and connect it to a realistic flying scenario.`,
            `Where does ${termD} show up in planning or in-flight decision making?`,
            `How would you teach ${termE} to another student in two minutes?`,
            `What is one common misunderstanding in this subject area?`,
            `What would a wrong answer on this week’s topic usually overlook?`,
            'Which note from your study sessions should become a flashcard?',
            'What condition, limitation, or exception deserves extra review?',
            'What is the safest conservative takeaway from this topic?',
            'How would this week’s subject affect a go/no-go decision?',
            'What part of the week objective feels strongest now?',
            'What part of the week objective still needs repetition?',
            'Which reference source explained the topic more clearly for you, and why?',
            'What is one question you would bring to an instructor about this subject?' 
        ];
    },

    getWeek(weekNumber) {
        return this.getSchedule()[weekNumber - 1];
    },

    getDefaultDayStatus(day) {
        return day === 7 ? 'review' : 'not-started';
    },

    getDayKey(weekNumber, day) {
        return `w${weekNumber}d${day}`;
    },

    getWeekProgress(state, weekNumber) {
        let completed = 0;
        for (let day = 1; day <= STUDY_DAYS_PER_WEEK; day += 1) {
            const status = this.getDayStatus(state, weekNumber, day);
            if (status === 'completed') {
                completed += 1;
            }
        }
        return Math.round((completed / STUDY_DAYS_PER_WEEK) * 100);
    },

    getDayStatus(state, weekNumber, day) {
        const key = this.getDayKey(weekNumber, day);
        return state.daily[key]?.status || this.getDefaultDayStatus(day);
    },

    getDayNotes(state, weekNumber, day) {
        const key = this.getDayKey(weekNumber, day);
        return state.daily[key]?.notes || '';
    },

    getTodayPlan(state) {
        const currentWeek = ProgressService.getCurrentWeek(state);
        const week = this.getWeek(currentWeek);
        let currentDay = 1;

        for (let day = 1; day <= STUDY_DAYS_PER_WEEK; day += 1) {
            if (this.getDayStatus(state, currentWeek, day) !== 'completed') {
                currentDay = day;
                break;
            }

            if (day === STUDY_DAYS_PER_WEEK) {
                currentDay = 7;
            }
        }

        const dayPlan = week.dailyBreakdown[currentDay - 1];
        return {
            week,
            currentDay,
            dayPlan,
            note: this.getDayNotes(state, week.weekNumber, currentDay)
        };
    }
};

const QuestionBank = questionBlueprints.flatMap((group) => {
    const slug = group.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return group.questions.map((question, index) => ({
        id: `${slug}-${String(index + 1).padStart(3, '0')}`,
        subject: group.subject,
        sourceTopic: group.sourceTopic,
        ...question
    }));
});

const GroundSchoolStore = {
    state: null,

    defaultState() {
        return {
            version: 1,
            weeks: {},
            daily: {},
            review: {},
            quiz: {
                attempts: [],
                subjectStats: {},
                missedQuestionIds: [],
                practiceExamScore: null
            },
            ui: {
                selectedReviewWeek: 1,
                selectedSubject: 'All Subjects'
            }
        };
    },

    load() {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}state`);

        if (!raw) {
            this.state = this.defaultState();
            return this.state;
        }

        try {
            const parsed = JSON.parse(raw);
            this.state = this.mergeWithDefaults(parsed);
        } catch (error) {
            console.error('Failed to parse stored state:', error);
            this.state = this.defaultState();
        }

        return this.state;
    },

    mergeWithDefaults(partial) {
        const defaults = this.defaultState();
        return {
            ...defaults,
            ...partial,
            weeks: { ...defaults.weeks, ...(partial.weeks || {}) },
            daily: { ...defaults.daily, ...(partial.daily || {}) },
            review: { ...defaults.review, ...(partial.review || {}) },
            quiz: {
                ...defaults.quiz,
                ...(partial.quiz || {}),
                attempts: Array.isArray(partial.quiz?.attempts) ? partial.quiz.attempts : [],
                subjectStats: partial.quiz?.subjectStats || {},
                missedQuestionIds: Array.isArray(partial.quiz?.missedQuestionIds) ? partial.quiz.missedQuestionIds : [],
                practiceExamScore: typeof partial.quiz?.practiceExamScore === 'number' ? partial.quiz.practiceExamScore : null
            },
            ui: {
                ...defaults.ui,
                ...(partial.ui || {})
            }
        };
    },

    save() {
        localStorage.setItem(`${STORAGE_PREFIX}state`, JSON.stringify(this.state));
    },

    getState() {
        if (!this.state) {
            this.load();
        }
        return this.state;
    },

    update(mutator) {
        const nextState = JSON.parse(JSON.stringify(this.getState()));
        mutator(nextState);
        this.state = this.mergeWithDefaults(nextState);
        this.save();
        return this.state;
    },

    exportData() {
        return JSON.stringify(this.getState(), null, 2);
    },

    importData(jsonString) {
        const parsed = JSON.parse(jsonString);
        this.state = this.mergeWithDefaults(parsed);
        this.save();
        return this.state;
    },

    reset() {
        this.state = this.defaultState();
        this.save();
        return this.state;
    }
};

const CalendarService = {
    getNextStatus(day, currentStatus) {
        const cycle = day === 7
            ? ['review', 'completed', 'missed', 'not-started']
            : ['not-started', 'completed', 'missed', 'review'];
        const currentIndex = cycle.indexOf(currentStatus);
        return cycle[(currentIndex + 1) % cycle.length];
    },

    toggleDayStatus(weekNumber, day) {
        GroundSchoolStore.update((state) => {
            const key = ScheduleService.getDayKey(weekNumber, day);
            const currentStatus = ScheduleService.getDayStatus(state, weekNumber, day);
            const nextStatus = this.getNextStatus(day, currentStatus);
            state.daily[key] = {
                ...(state.daily[key] || {}),
                status: nextStatus,
                notes: state.daily[key]?.notes || ''
            };
        });
    },

    getStreaks(state) {
        const sequence = [];
        for (let week = 1; week <= TOTAL_WEEKS; week += 1) {
            for (let day = 1; day <= STUDY_DAYS_PER_WEEK; day += 1) {
                sequence.push(ScheduleService.getDayStatus(state, week, day));
            }
        }

        let current = 0;
        for (let index = sequence.length - 1; index >= 0; index -= 1) {
            if (sequence[index] === 'completed') {
                current += 1;
            } else if (current > 0) {
                break;
            }
        }

        let longest = 0;
        let running = 0;
        sequence.forEach((status) => {
            if (status === 'completed') {
                running += 1;
                if (running > longest) {
                    longest = running;
                }
            } else {
                running = 0;
            }
        });

        return { current, longest };
    }
};

const QuizService = {
    session: null,

    getSubjects() {
        return [...new Set(QuestionBank.map((question) => question.subject))].sort();
    },

    sampleQuestions(questions, count) {
        const shuffled = [...questions];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled.slice(0, Math.min(count, shuffled.length));
    },

    start(mode, subject = null) {
        const state = GroundSchoolStore.getState();
        const metrics = ProgressService.getMetrics(state);
        const currentSubject = mapWeekSubjectToQuizSubject(metrics.currentSubject);
        let selectedQuestions = [];
        let label = '';

        if (mode === 'daily') {
            selectedQuestions = this.sampleQuestions(QuestionBank.filter((question) => question.subject === currentSubject), 5);
            label = 'Daily 5-Question Quiz';
        }

        if (mode === 'weekly') {
            const pool = QuestionBank.filter((question) => question.subject === currentSubject || question.subject === metrics.weakestSubject);
            selectedQuestions = this.sampleQuestions(pool.length ? pool : QuestionBank, 12);
            label = 'Weekly Review Quiz';
        }

        if (mode === 'random') {
            selectedQuestions = this.sampleQuestions(QuestionBank, 20);
            label = 'Random 20-Question Quiz';
        }

        if (mode === 'missed') {
            const missedSet = new Set(state.quiz.missedQuestionIds);
            const missedQuestions = QuestionBank.filter((question) => missedSet.has(question.id));
            selectedQuestions = this.sampleQuestions(missedQuestions, Math.min(10, missedQuestions.length));
            label = 'Missed Question Review';
        }

        if (mode === 'subject') {
            selectedQuestions = this.sampleQuestions(QuestionBank.filter((question) => question.subject === subject), 10);
            label = `${subject} Quiz`;
        }

        if (!selectedQuestions.length) {
            this.session = null;
            return { ok: false, message: mode === 'missed' ? 'No missed questions yet. Finish a quiz first.' : 'No questions available for that selection.' };
        }

        this.session = {
            mode,
            label,
            subject,
            questions: selectedQuestions,
            currentIndex: 0,
            answers: [],
            complete: false
        };

        return { ok: true };
    },

    answerCurrent(choiceIndex) {
        if (!this.session || this.session.complete) {
            return;
        }

        const currentQuestion = this.session.questions[this.session.currentIndex];
        if (this.session.answers.find((answer) => answer.questionId === currentQuestion.id)) {
            return;
        }

        const isCorrect = choiceIndex === currentQuestion.correctAnswer;
        this.session.answers.push({
            questionId: currentQuestion.id,
            subject: currentQuestion.subject,
            choiceIndex,
            isCorrect
        });
    },

    nextQuestion() {
        if (!this.session) {
            return;
        }

        if (this.session.currentIndex < this.session.questions.length - 1) {
            this.session.currentIndex += 1;
        } else {
            this.finishSession();
        }
    },

    finishSession() {
        if (!this.session || this.session.complete) {
            return;
        }

        this.session.complete = true;
        const total = this.session.questions.length;
        const correct = this.session.answers.filter((answer) => answer.isCorrect).length;
        const score = Math.round((correct / total) * 100);
        const missedIds = this.session.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId);

        GroundSchoolStore.update((state) => {
            const attempt = {
                id: `quiz-${Date.now()}`,
                date: new Date().toISOString(),
                mode: this.session.mode,
                label: this.session.label,
                subject: this.session.subject,
                total,
                correct,
                score,
                answers: this.session.answers
            };

            state.quiz.attempts.push(attempt);
            const missedSet = new Set(state.quiz.missedQuestionIds);
            this.session.questions.forEach((question) => {
                const answer = this.session.answers.find((entry) => entry.questionId === question.id);
                if (!state.quiz.subjectStats[question.subject]) {
                    state.quiz.subjectStats[question.subject] = { correct: 0, total: 0 };
                }
                state.quiz.subjectStats[question.subject].total += 1;
                if (answer?.isCorrect) {
                    state.quiz.subjectStats[question.subject].correct += 1;
                    missedSet.delete(question.id);
                } else {
                    missedSet.add(question.id);
                }
            });

            state.quiz.missedQuestionIds = [...missedSet];
        });
    },

    getCurrentQuestion() {
        if (!this.session) {
            return null;
        }
        return this.session.questions[this.session.currentIndex];
    }
};

const ProgressService = {
    getCurrentWeek(state) {
        for (let week = 1; week <= TOTAL_WEEKS; week += 1) {
            if (!this.isWeekComplete(state, week)) {
                return week;
            }
        }
        return TOTAL_WEEKS;
    },

    isWeekComplete(state, weekNumber) {
        const explicitComplete = Boolean(state.weeks[weekNumber]?.completed);
        if (explicitComplete) {
            return true;
        }
        return ScheduleService.getWeekProgress(state, weekNumber) === 100;
    },

    getCompletedStudyDays(state) {
        let completed = 0;
        Object.values(state.daily).forEach((entry) => {
            if (entry.status === 'completed') {
                completed += 1;
            }
        });
        return completed;
    },

    getCompletedWeeks(state) {
        let completed = 0;
        for (let week = 1; week <= TOTAL_WEEKS; week += 1) {
            if (this.isWeekComplete(state, week)) {
                completed += 1;
            }
        }
        return completed;
    },

    getMissedDays(state) {
        return Object.values(state.daily).filter((entry) => entry.status === 'missed').length;
    },

    getQuizAverage(state) {
        if (!state.quiz.attempts.length) {
            return 0;
        }
        const total = state.quiz.attempts.reduce((sum, attempt) => sum + attempt.score, 0);
        return Math.round(total / state.quiz.attempts.length);
    },

    getLastThreeScores(state) {
        return state.quiz.attempts.slice(-3).map((attempt) => attempt.score);
    },

    getSubjectAccuracies(state) {
        return Object.entries(state.quiz.subjectStats).map(([subject, stats]) => ({
            subject,
            accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
            total: stats.total
        })).sort((left, right) => left.accuracy - right.accuracy);
    },

    getWeakSubjects(state) {
        return this.getSubjectAccuracies(state).filter((entry) => entry.total >= 3 && entry.accuracy < 75);
    },

    getReadiness(state) {
        const quizAverage = this.getQuizAverage(state);
        const lastThreeScores = this.getLastThreeScores(state);
        const lastThreeAverage = lastThreeScores.length
            ? Math.round(lastThreeScores.reduce((sum, score) => sum + score, 0) / lastThreeScores.length)
            : 0;
        const completionPercent = Math.round((this.getCompletedStudyDays(state) / (TOTAL_WEEKS * STUDY_DAYS_PER_WEEK)) * 100);
        const weakSubjects = this.getWeakSubjects(state).length;
        const practiceExam = typeof state.quiz.practiceExamScore === 'number' ? state.quiz.practiceExamScore : quizAverage;
        const readinessScore = Math.max(0, Math.min(100,
            Math.round(
                (quizAverage * 0.4) +
                (lastThreeAverage * 0.2) +
                (completionPercent * 0.15) +
                (practiceExam * 0.2) +
                ((Math.max(0, 100 - (weakSubjects * 12))) * 0.05)
            )
        ));

        let level = 'Not Ready';
        let action = 'Finish the current week, raise quiz consistency, and focus on weak subjects.';

        if (readinessScore >= 90) {
            level = 'Exam Ready';
            action = 'Book a final practice exam, keep review light, and protect consistency.';
        } else if (readinessScore >= 80) {
            level = 'Nearly Ready';
            action = 'Shift toward timed quizzes and targeted weak-area review.';
        } else if (readinessScore >= 70) {
            level = 'Building';
            action = 'Keep weekly momentum and raise subject accuracy before booking the FAA exam.';
        }

        return {
            readinessScore,
            level,
            action,
            quizAverage,
            lastThreeAverage,
            completionPercent,
            weakSubjects,
            practiceExam
        };
    },

    getMetrics(state) {
        const currentWeek = this.getCurrentWeek(state);
        const currentWeekPlan = ScheduleService.getWeek(currentWeek);
        const streaks = CalendarService.getStreaks(state);
        const quizAverage = this.getQuizAverage(state);
        const weakestSubject = this.getSubjectAccuracies(state)[0]?.subject || 'None yet';

        return {
            currentWeek,
            currentSubject: currentWeekPlan.mainSubject,
            currentPhase: currentWeekPlan.phaseName,
            completedStudyDays: this.getCompletedStudyDays(state),
            completedWeeks: this.getCompletedWeeks(state),
            missedDays: this.getMissedDays(state),
            completionPercent: Math.round((this.getCompletedStudyDays(state) / (TOTAL_WEEKS * STUDY_DAYS_PER_WEEK)) * 100),
            quizAverage,
            weakestSubject,
            streaks,
            readiness: this.getReadiness(state)
        };
    }
};

const RenderService = {
    renderAll() {
        const state = GroundSchoolStore.getState();
        this.renderHero(state);
        this.renderDashboard(state);
        this.renderTodayPlan(state);
        this.renderSchedule(state);
        this.renderCalendar(state);
        this.renderQuiz(state);
        this.renderWeeklyReview(state);
        this.renderReadiness(state);
        this.renderFooterYear();
    },

    renderHero(state) {
        const metrics = ProgressService.getMetrics(state);
        document.getElementById('heroCurrentSubject').textContent = `Week ${metrics.currentWeek}: ${metrics.currentSubject}`;
        document.getElementById('heroCourseNote').textContent = `Current phase: ${metrics.currentPhase}. Keep the rhythm at about one hour per study session.`;

        const heroMetrics = [
            { label: 'Current week', value: `Week ${metrics.currentWeek}` },
            { label: 'Overall progress', value: `${metrics.completionPercent}%` },
            { label: 'Current subject', value: metrics.currentSubject },
            { label: 'Study streak', value: `${metrics.streaks.current} days` },
            { label: 'Readiness score', value: `${metrics.readiness.readinessScore}%` }
        ];

        document.getElementById('heroMetrics').innerHTML = heroMetrics.map((metric) => `
            <div class="hero-stat">
                <span>${metric.label}</span>
                <strong>${metric.value}</strong>
            </div>
        `).join('');
    },

    renderDashboard(state) {
        const metrics = ProgressService.getMetrics(state);
        const cards = [
            { label: 'Overall completion', value: `${metrics.completionPercent}%`, note: 'Based on 312 study sessions' },
            { label: 'Completed study days', value: String(metrics.completedStudyDays), note: 'One-hour sessions logged' },
            { label: 'Completed weeks', value: String(metrics.completedWeeks), note: 'Full weeks checked off' },
            { label: 'Missed days', value: String(metrics.missedDays), note: 'Use catch-up days to recover' },
            { label: 'Current phase', value: metrics.currentPhase, note: 'Active section of the 52-week plan' },
            { label: 'Quiz average', value: `${metrics.quizAverage}%`, note: 'Across all finished quizzes' },
            { label: 'Weakest subject', value: metrics.weakestSubject, note: 'Lowest current accuracy' },
            { label: 'FAA readiness', value: `${metrics.readiness.level}`, note: `${metrics.readiness.readinessScore}% readiness score` }
        ];

        document.getElementById('dashboardGrid').innerHTML = cards.map((card) => `
            <div class="metric reveal is-visible">
                <div class="metric-label">${card.label}</div>
                <strong>${card.value}</strong>
                <small>${card.note}</small>
            </div>
        `).join('');
    },

    renderTodayPlan(state) {
        const today = ScheduleService.getTodayPlan(state);
        const metrics = ProgressService.getMetrics(state);
        const dayStatus = ScheduleService.getDayStatus(state, today.week.weekNumber, today.currentDay);
        const dailyPromptQuestions = QuizService.sampleQuestions(
            QuestionBank.filter((question) => question.subject === mapWeekSubjectToQuizSubject(today.week.mainSubject)),
            5
        );

        document.getElementById('todayOverview').innerHTML = [
            { label: 'Current week', value: `Week ${today.week.weekNumber}` },
            { label: 'Current day', value: today.dayPlan.label },
            { label: 'Today\'s topic', value: today.dayPlan.topic },
            { label: 'Study target', value: '60 minutes' },
            { label: 'Current phase', value: today.week.phaseName },
            { label: 'Week progress', value: `${ScheduleService.getWeekProgress(state, today.week.weekNumber)}%` }
        ].map((entry) => `
            <div class="helper-card">
                <div class="mini-label">${entry.label}</div>
                <strong>${entry.value}</strong>
            </div>
        `).join('');

        document.getElementById('todayReading').textContent = today.dayPlan.readingTask;
        document.getElementById('todayReviewTask').textContent = today.dayPlan.reviewTask;
        document.getElementById('todayQuestions').innerHTML = dailyPromptQuestions.map((question) => `<li>${question.question}</li>`).join('');
        document.getElementById('todayNotes').value = today.note;
        document.getElementById('todayStatusText').textContent = `Status: ${this.labelize(dayStatus)}`;

        document.getElementById('studySignals').innerHTML = [
            `You have completed ${metrics.completedStudyDays} of ${TOTAL_WEEKS * STUDY_DAYS_PER_WEEK} planned study sessions.`,
            `Current streak: ${metrics.streaks.current} days. Longest streak: ${metrics.streaks.longest} days.`,
            `Current subject: ${metrics.currentSubject}. Weakest subject signal: ${metrics.weakestSubject}.`,
            `Readiness level: ${metrics.readiness.level} at ${metrics.readiness.readinessScore}%.`
        ].map((message) => `<div class="helper-card"><p class="muted fine-print">${message}</p></div>`).join('');
    },

    renderSchedule(state) {
        const schedule = ScheduleService.getSchedule();
        const currentWeek = ProgressService.getCurrentWeek(state);
        document.getElementById('scheduleSummary').textContent = `Current week: ${currentWeek} of ${TOTAL_WEEKS}`;

        document.getElementById('scheduleList').innerHTML = schedule.map((week) => {
            const completion = ScheduleService.getWeekProgress(state, week.weekNumber);
            const note = state.weeks[week.weekNumber]?.notes || '';
            const checked = ProgressService.isWeekComplete(state, week.weekNumber) ? 'checked' : '';
            const open = week.weekNumber === currentWeek ? 'open' : '';

            return `
                <details class="week-panel reveal is-visible" id="week-${week.weekNumber}" ${open}>
                    <summary class="week-summary">
                        <div>
                            <h3>Week ${week.weekNumber}: ${week.mainSubject}</h3>
                            <p class="muted">${week.phaseName}</p>
                        </div>
                        <div class="week-status">
                            <span class="badge">${completion}% complete</span>
                            <span class="badge">${week.estimatedHours} hrs</span>
                        </div>
                    </summary>
                    <div class="week-content">
                        <div class="week-topline">
                            <div class="helper-card">
                                <div class="mini-label">Main subject</div>
                                <strong>${week.mainSubject}</strong>
                            </div>
                            <div class="helper-card">
                                <div class="mini-label">PHAK topic</div>
                                <strong>${week.phakTopic}</strong>
                            </div>
                            <div class="helper-card">
                                <div class="mini-label">Jeppesen topic</div>
                                <strong>${week.jeppTopic}</strong>
                            </div>
                        </div>
                        <div class="field-grid">
                            <div class="helper-card">
                                <div class="mini-label">Weekly objective</div>
                                <p class="muted fine-print">${week.objective}</p>
                            </div>
                            <div class="helper-card">
                                <div class="mini-label">Key terms</div>
                                <p class="muted fine-print">${week.keyTerms.join(', ')}</p>
                            </div>
                        </div>
                        <div>
                            <h4>Daily study breakdown</h4>
                            <div class="day-list">
                                ${week.dailyBreakdown.map((day) => `
                                    <div class="day-row">
                                        <strong>${day.label}: ${day.topic}</strong>
                                        <div class="muted fine-print">Reading: ${day.readingTask}</div>
                                        <div class="muted fine-print">Review: ${day.reviewTask}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="field-grid">
                            <label>
                                <span>Week ${week.weekNumber} notes</span>
                                <textarea data-week-notes="${week.weekNumber}" placeholder="Add notes, mnemonics, weak spots, or edition-specific page references.">${note}</textarea>
                            </label>
                            <label class="helper-card" style="align-content:start;">
                                <span>Completion</span>
                                <span class="status-inline">
                                    <input type="checkbox" data-week-complete="${week.weekNumber}" ${checked}>
                                    <span class="muted fine-print">Mark this week complete when the readings and review are closed out.</span>
                                </span>
                            </label>
                        </div>
                    </div>
                </details>
            `;
        }).join('');
    },

    renderCalendar(state) {
        const streaks = CalendarService.getStreaks(state);
        document.getElementById('calendarGrid').innerHTML = Array.from({ length: TOTAL_WEEKS }, (_, offset) => {
            const weekNumber = offset + 1;
            return `
                <div class="calendar-week">
                    <div>
                        <strong>Week ${weekNumber}</strong>
                        <small>${ScheduleService.getWeek(weekNumber).mainSubject}</small>
                    </div>
                    ${Array.from({ length: 7 }, (_, dayOffset) => {
                        const day = dayOffset + 1;
                        const status = ScheduleService.getDayStatus(state, weekNumber, day);
                        return `
                            <button
                                type="button"
                                class="day-cell"
                                data-week="${weekNumber}"
                                data-day="${day}"
                                data-status="${status}"
                                aria-label="Week ${weekNumber}, ${DAY_LABELS[dayOffset]}, status ${this.labelize(status)}"
                            >${day}</button>
                        `;
                    }).join('')}
                    <div class="muted fine-print">${ScheduleService.getWeekProgress(state, weekNumber)}%</div>
                </div>
            `;
        }).join('');

        document.getElementById('calendarStats').innerHTML = [
            { label: 'Current streak', value: `${streaks.current} days` },
            { label: 'Longest streak', value: `${streaks.longest} days` },
            { label: 'Completed weeks', value: `${ProgressService.getCompletedWeeks(state)} / ${TOTAL_WEEKS}` },
            { label: 'Missed days', value: String(ProgressService.getMissedDays(state)) }
        ].map((item) => `
            <div class="helper-card">
                <div class="mini-label">${item.label}</div>
                <strong>${item.value}</strong>
            </div>
        `).join('');
    },

    renderQuiz(state) {
        const quizCard = document.getElementById('quizCard');
        const subjects = ['All Subjects', ...QuizService.getSubjects()];
        const subjectSelect = document.getElementById('subjectSelect');
        const selectedSubject = state.ui.selectedSubject || 'All Subjects';

        subjectSelect.innerHTML = subjects.map((subject) => `
            <option value="${subject}" ${subject === selectedSubject ? 'selected' : ''}>${subject}</option>
        `).join('');

        if (!QuizService.session) {
            quizCard.innerHTML = `
                <div class="helper-card">
                    <div class="mini-label">Ready when you are</div>
                    <strong>Select a quiz mode to begin.</strong>
                    <p class="muted fine-print">This engine tracks score, missed questions, subject accuracy, and your last three quiz results.</p>
                </div>
            `;
        } else {
            const session = QuizService.session;
            const question = QuizService.getCurrentQuestion();
            const answer = session.answers.find((entry) => entry.questionId === question?.id);

            if (session.complete) {
                const correct = session.answers.filter((entry) => entry.isCorrect).length;
                const score = Math.round((correct / session.questions.length) * 100);
                quizCard.innerHTML = `
                    <div class="helper-card">
                        <div class="mini-label">${session.label}</div>
                        <strong>Score: ${score}%</strong>
                        <p class="muted fine-print">${correct} correct out of ${session.questions.length}. Start another quiz mode to continue studying.</p>
                    </div>
                `;
            } else if (question) {
                quizCard.innerHTML = `
                    <div class="quiz-summary">
                        <div class="helper-card"><div class="mini-label">Mode</div><strong>${session.label}</strong></div>
                        <div class="helper-card"><div class="mini-label">Question</div><strong>${session.currentIndex + 1} / ${session.questions.length}</strong></div>
                        <div class="helper-card"><div class="mini-label">Subject</div><strong>${question.subject}</strong></div>
                    </div>
                    <div class="stack" style="margin-top:18px;">
                        <div>
                            <div class="mini-label">${question.difficulty} · ${question.sourceTopic}</div>
                            <h3 style="margin-top:6px;">${question.question}</h3>
                        </div>
                        <div class="choice-list">
                            ${question.choices.map((choice, index) => {
                                let buttonClass = 'choice-btn';
                                if (answer) {
                                    if (index === question.correctAnswer) {
                                        buttonClass += ' correct';
                                    } else if (index === answer.choiceIndex && !answer.isCorrect) {
                                        buttonClass += ' incorrect';
                                    }
                                }
                                return `<button class="${buttonClass}" data-answer-index="${index}" type="button" ${answer ? 'disabled' : ''}>${choice}</button>`;
                            }).join('')}
                        </div>
                        ${answer ? `
                            <div class="helper-card">
                                <div class="mini-label">Explanation</div>
                                <p class="muted fine-print">${question.explanation}</p>
                                <button class="btn secondary" id="nextQuestionBtn" type="button">${session.currentIndex === session.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        }

        const lastThree = ProgressService.getLastThreeScores(state);
        const subjectStats = ProgressService.getSubjectAccuracies(state).slice(0, 6);
        document.getElementById('quizStats').innerHTML = `
            <div class="helper-card">
                <div class="mini-label">Quiz average</div>
                <strong>${ProgressService.getQuizAverage(state)}%</strong>
            </div>
            <div class="helper-card">
                <div class="mini-label">Last 3 scores</div>
                <strong>${lastThree.length ? lastThree.join(' · ') : 'No scores yet'}</strong>
            </div>
            <div class="helper-card">
                <div class="mini-label">Missed questions</div>
                <strong>${state.quiz.missedQuestionIds.length}</strong>
            </div>
            <div class="subject-stats">
                ${subjectStats.length ? subjectStats.map((item) => `
                    <div class="helper-card">
                        <div class="mini-label">${item.subject}</div>
                        <strong>${item.accuracy}%</strong>
                    </div>
                `).join('') : '<div class="helper-card"><p class="muted fine-print">Subject accuracy appears after your first quiz.</p></div>'}
            </div>
        `;
    },

    renderWeeklyReview(state) {
        const currentWeek = ProgressService.getCurrentWeek(state);
        const selectedWeek = Math.min(TOTAL_WEEKS, Math.max(1, Number(state.ui.selectedReviewWeek || currentWeek)));
        const week = ScheduleService.getWeek(selectedWeek);
        const reviewState = state.review[selectedWeek] || { confidence: 3, weakNotes: '', completed: false };

        document.getElementById('reviewWeekSelect').innerHTML = Array.from({ length: TOTAL_WEEKS }, (_, offset) => {
            const weekNumber = offset + 1;
            return `<option value="${weekNumber}" ${weekNumber === selectedWeek ? 'selected' : ''}>Week ${weekNumber}</option>`;
        }).join('');

        document.getElementById('confidenceSelect').value = String(reviewState.confidence || 3);
        document.getElementById('reviewWeekTitle').textContent = `Week ${selectedWeek}: ${week.mainSubject}`;
        document.getElementById('reviewSummaryText').textContent = week.summary;
        document.getElementById('reviewSummary').innerHTML = [
            { label: 'Phase', value: week.phaseName },
            { label: 'Objective', value: week.objective },
            { label: 'Completion', value: `${ScheduleService.getWeekProgress(state, selectedWeek)}% of study days complete` }
        ].map((item) => `
            <div class="helper-card">
                <div class="mini-label">${item.label}</div>
                <strong>${item.value}</strong>
            </div>
        `).join('');

        document.getElementById('reviewQuestionsList').innerHTML = week.reviewQuestions.map((question) => `<li>${question}</li>`).join('');
        document.getElementById('weakAreaNotes').value = reviewState.weakNotes || '';
        document.getElementById('reviewStatusText').textContent = reviewState.completed ? 'Review marked complete.' : 'Review not yet marked complete.';

        document.getElementById('reviewMeta').innerHTML = `
            <div class="helper-card">
                <div class="mini-label">Key terms</div>
                <strong>${week.keyTerms.join(', ')}</strong>
            </div>
            <div class="helper-card">
                <div class="mini-label">Confidence rating</div>
                <strong>${reviewState.confidence || 3} / 5</strong>
            </div>
            <div class="helper-card">
                <div class="mini-label">Weak-area notes</div>
                <p class="muted fine-print">${reviewState.weakNotes || 'No weak-area notes saved yet.'}</p>
            </div>
        `;
    },

    renderReadiness(state) {
        const readiness = ProgressService.getReadiness(state);
        document.getElementById('readinessLevel').textContent = `${readiness.level} · ${readiness.readinessScore}%`;
        document.getElementById('readinessAction').textContent = readiness.action;
        document.getElementById('readinessBar').style.width = `${readiness.readinessScore}%`;
        document.getElementById('practiceExamScore').value = typeof state.quiz.practiceExamScore === 'number' ? state.quiz.practiceExamScore : '';
        document.getElementById('readinessBreakdown').innerHTML = [
            `Quiz average: ${readiness.quizAverage}%`,
            `Last 3 quiz average: ${readiness.lastThreeAverage}%`,
            `Course completion: ${readiness.completionPercent}%`,
            `Weak subject count: ${readiness.weakSubjects}`,
            `Practice exam score: ${readiness.practiceExam}%`
        ].map((item) => `<div class="helper-card"><p class="muted fine-print">${item}</p></div>`).join('');
    },

    renderFooterYear() {
        document.getElementById('y').textContent = new Date().getFullYear();
    },

    labelize(value) {
        return value.replace(/-/g, ' ');
    },

};

const App = {
    init() {
        GroundSchoolStore.load();
        this.bindEvents();
        this.applyMotionAndHeader();
        RenderService.renderAll();
    },

    bindEvents() {
        document.getElementById('startTodayBtn').addEventListener('click', () => {
            document.getElementById('today-plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        document.getElementById('viewWeekBtn').addEventListener('click', () => {
            this.openCurrentWeek();
            document.getElementById('schedule').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        document.getElementById('practiceQuizBtn').addEventListener('click', () => {
            QuizService.start('daily');
            RenderService.renderQuiz(GroundSchoolStore.getState());
            document.getElementById('quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        document.getElementById('markTodayComplete').addEventListener('click', () => {
            const state = GroundSchoolStore.getState();
            const today = ScheduleService.getTodayPlan(state);
            GroundSchoolStore.update((draft) => {
                const key = ScheduleService.getDayKey(today.week.weekNumber, today.currentDay);
                draft.daily[key] = {
                    ...(draft.daily[key] || {}),
                    status: today.currentDay === 7 ? 'review' : 'completed',
                    notes: document.getElementById('todayNotes').value.trim()
                };
            });
            RenderService.renderAll();
        });

        document.getElementById('todayNotes').addEventListener('change', () => {
            const state = GroundSchoolStore.getState();
            const today = ScheduleService.getTodayPlan(state);
            GroundSchoolStore.update((draft) => {
                const key = ScheduleService.getDayKey(today.week.weekNumber, today.currentDay);
                draft.daily[key] = {
                    ...(draft.daily[key] || {}),
                    status: draft.daily[key]?.status || ScheduleService.getDefaultDayStatus(today.currentDay),
                    notes: document.getElementById('todayNotes').value.trim()
                };
            });
        });

        document.getElementById('jumpCurrentWeek').addEventListener('click', () => {
            this.openCurrentWeek();
            const currentWeek = ProgressService.getCurrentWeek(GroundSchoolStore.getState());
            document.getElementById(`week-${currentWeek}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        document.getElementById('scheduleList').addEventListener('change', (event) => {
            const weekComplete = event.target.getAttribute('data-week-complete');
            const weekNotes = event.target.getAttribute('data-week-notes');

            if (weekComplete) {
                GroundSchoolStore.update((state) => {
                    state.weeks[weekComplete] = {
                        ...(state.weeks[weekComplete] || {}),
                        completed: event.target.checked,
                        notes: state.weeks[weekComplete]?.notes || ''
                    };
                });
                RenderService.renderAll();
            }

            if (weekNotes) {
                GroundSchoolStore.update((state) => {
                    state.weeks[weekNotes] = {
                        ...(state.weeks[weekNotes] || {}),
                        completed: state.weeks[weekNotes]?.completed || false,
                        notes: event.target.value
                    };
                });
            }
        });

        document.getElementById('calendarGrid').addEventListener('click', (event) => {
            const button = event.target.closest('.day-cell');
            if (!button) {
                return;
            }
            CalendarService.toggleDayStatus(Number(button.dataset.week), Number(button.dataset.day));
            RenderService.renderAll();
        });

        document.querySelector('.quiz-toolbar').addEventListener('click', (event) => {
            const button = event.target.closest('[data-quiz-mode]');
            if (!button) {
                return;
            }
            const result = QuizService.start(button.dataset.quizMode);
            if (!result.ok) {
                document.getElementById('quizCard').innerHTML = `<div class="helper-card"><p class="muted fine-print">${result.message}</p></div>`;
            }
            RenderService.renderQuiz(GroundSchoolStore.getState());
        });

        document.getElementById('subjectSelect').addEventListener('change', (event) => {
            GroundSchoolStore.update((state) => {
                state.ui.selectedSubject = event.target.value;
            });
        });

        document.getElementById('startSubjectQuiz').addEventListener('click', () => {
            const subject = document.getElementById('subjectSelect').value;
            if (subject === 'All Subjects') {
                QuizService.start('random');
            } else {
                QuizService.start('subject', subject);
            }
            RenderService.renderQuiz(GroundSchoolStore.getState());
        });

        document.getElementById('quizCard').addEventListener('click', (event) => {
            const answerButton = event.target.closest('[data-answer-index]');
            if (answerButton) {
                QuizService.answerCurrent(Number(answerButton.dataset.answerIndex));
                RenderService.renderQuiz(GroundSchoolStore.getState());
                return;
            }

            if (event.target.id === 'nextQuestionBtn') {
                QuizService.nextQuestion();
                RenderService.renderAll();
            }
        });

        document.getElementById('reviewWeekSelect').addEventListener('change', (event) => {
            GroundSchoolStore.update((state) => {
                state.ui.selectedReviewWeek = Number(event.target.value);
            });
            RenderService.renderWeeklyReview(GroundSchoolStore.getState());
        });

        document.getElementById('confidenceSelect').addEventListener('change', (event) => {
            const selectedWeek = Number(document.getElementById('reviewWeekSelect').value);
            GroundSchoolStore.update((state) => {
                state.review[selectedWeek] = {
                    ...(state.review[selectedWeek] || {}),
                    confidence: Number(event.target.value),
                    weakNotes: state.review[selectedWeek]?.weakNotes || '',
                    completed: state.review[selectedWeek]?.completed || false
                };
            });
            RenderService.renderWeeklyReview(GroundSchoolStore.getState());
        });

        document.getElementById('weakAreaNotes').addEventListener('change', (event) => {
            const selectedWeek = Number(document.getElementById('reviewWeekSelect').value);
            GroundSchoolStore.update((state) => {
                state.review[selectedWeek] = {
                    ...(state.review[selectedWeek] || {}),
                    confidence: state.review[selectedWeek]?.confidence || 3,
                    weakNotes: event.target.value.trim(),
                    completed: state.review[selectedWeek]?.completed || false
                };
            });
            RenderService.renderWeeklyReview(GroundSchoolStore.getState());
        });

        document.getElementById('markWeekComplete').addEventListener('click', () => {
            const selectedWeek = Number(document.getElementById('reviewWeekSelect').value);
            GroundSchoolStore.update((state) => {
                state.review[selectedWeek] = {
                    ...(state.review[selectedWeek] || {}),
                    confidence: Number(document.getElementById('confidenceSelect').value),
                    weakNotes: document.getElementById('weakAreaNotes').value.trim(),
                    completed: true
                };
                state.weeks[selectedWeek] = {
                    ...(state.weeks[selectedWeek] || {}),
                    completed: true,
                    notes: state.weeks[selectedWeek]?.notes || ''
                };
            });
            RenderService.renderAll();
        });

        document.getElementById('savePracticeExam').addEventListener('click', () => {
            const value = Number(document.getElementById('practiceExamScore').value);
            GroundSchoolStore.update((state) => {
                state.quiz.practiceExamScore = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
            });
            RenderService.renderReadiness(GroundSchoolStore.getState());
        });

        document.getElementById('exportProgress').addEventListener('click', () => {
            const blob = new Blob([GroundSchoolStore.exportData()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'private-pilot-ground-school-progress.json';
            anchor.click();
            URL.revokeObjectURL(url);
            document.getElementById('dataToolStatus').textContent = 'Progress exported as JSON.';
        });

        document.getElementById('importProgress').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }

            const text = await file.text();
            try {
                GroundSchoolStore.importData(text);
                document.getElementById('dataToolStatus').textContent = 'Progress imported successfully.';
                RenderService.renderAll();
            } catch (error) {
                console.error(error);
                document.getElementById('dataToolStatus').textContent = 'Import failed. Verify the JSON file and try again.';
            }
            event.target.value = '';
        });

        document.getElementById('resetProgress').addEventListener('click', () => {
            if (!window.confirm('Reset all course progress, quiz history, notes, and readiness data?')) {
                return;
            }
            GroundSchoolStore.reset();
            QuizService.session = null;
            document.getElementById('dataToolStatus').textContent = 'Progress reset.';
            RenderService.renderAll();
        });

        document.getElementById('printPlan').addEventListener('click', () => {
            window.print();
        });
    },

    openCurrentWeek() {
        const currentWeek = ProgressService.getCurrentWeek(GroundSchoolStore.getState());
        document.querySelectorAll('#scheduleList details').forEach((detail) => {
            detail.open = detail.id === `week-${currentWeek}`;
        });
    },

    applyMotionAndHeader() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const header = document.querySelector('header');
        const onScroll = () => {
            if (window.scrollY > 4) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        if (!prefersReduced && 'IntersectionObserver' in window) {
            const revealElements = document.querySelectorAll('.reveal');
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        obs.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
            revealElements.forEach((element) => observer.observe(element));
        } else {
            document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});