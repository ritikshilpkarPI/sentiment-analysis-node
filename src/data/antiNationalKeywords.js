// Anti-National Sentiment Detection Keywords
const antiNationalKeywords = {
  // Direct Anti-National Terms
  "direct_anti_national": [
    "भारत विरोधी", "anti india", "भारत का दुश्मन", "india ka dushman",
    "देशद्रोही", "deshdrohi", "traitor", "गद्दार", "gaddar",
    "भारत तोड़ो", "bharat todo", "break india", "भारत को तोड़ो",
    "हिंदुस्तान मुर्दाबाद", "hindustan murdabad", "death to india",
    "भारत को नष्ट करो", "destroy india", "भारत का अंत"
  ],

  // Separatist Movements
  "separatist": [
    "कश्मीर आज़ादी", "kashmir azadi", "kashmir independence",
    "पंजाब आज़ादी", "punjab azadi", "khalistan", "खालिस्तान",
    "असम आज़ादी", "assam azadi", "northeast independence",
    "तमिलनाडु आज़ादी", "tamil nadu azadi", "dravida nadu",
    "महाराष्ट्र आज़ादी", "maharashtra azadi", "maratha rajya"
  ],

  // Anti-Constitutional Terms
  "anti_constitutional": [
    "संविधान तोड़ो", "break constitution", "संविधान का विरोध",
    "लोकतंत्र का विरोध", "anti democracy", "democracy murdabad",
    "चुनाव का विरोध", "anti election", "चुनाव बहिष्कार",
    "सरकार का विरोध", "anti government", "सरकार गिराओ"
  ],

  // Religious Extremism
  "religious_extremism": [
    "धर्म युद्ध", "religious war", "जिहाद", "jihad",
    "धर्मांतरण", "conversion", "गौ हत्या", "cow slaughter",
    "मंदिर तोड़ो", "break temple", "मस्जिद तोड़ो", "break mosque",
    "हिंदू मुस्लिम दंगा", "hindu muslim riot", "communal violence"
  ],

  // Violence and Terrorism
  "violence_terrorism": [
    "हिंसा", "violence", "बम", "bomb", "आतंकवाद", "terrorism",
    "हत्या", "murder", "कत्ल", "killing", "खून", "blood",
    "अस्त्र शस्त्र", "weapons", "बंदूक", "gun", "पिस्तौल", "pistol",
    "विस्फोट", "explosion", "ब्लास्ट", "blast"
  ],

  // Anti-Security Forces
  "anti_security_forces": [
    "पुलिस मुर्दाबाद", "police murdabad", "army murdabad",
    "सेना का विरोध", "anti army", "सेना हटाओ", "remove army",
    "CRPF मुर्दाबाद", "CRPF murdabad", "BSF murdabad",
    "सुरक्षा बलों का विरोध", "anti security forces"
  ],

  // Economic Sabotage
  "economic_sabotage": [
    "अर्थव्यवस्था तोड़ो", "break economy", "रुपया गिराओ", "rupee down",
    "बाजार तोड़ो", "break market", "व्यापार बंद", "stop trade",
    "निवेश रोको", "stop investment", "विदेशी निवेश रोको"
  ],

  // Social Unrest
  "social_unrest": [
    "जाति युद्ध", "caste war", "जाति भेद", "caste discrimination",
    "लिंग भेद", "gender discrimination", "महिला उत्पीड़न", "women harassment",
    "बाल श्रम", "child labor", "गरीबी", "poverty exploitation",
    "अशिक्षा", "illiteracy", "अंधविश्वास", "superstition"
  ],

  // Regional Discontent
  "regional_discontent": [
    "मध्य प्रदेश अलग", "MP separate", "मध्य प्रदेश आज़ादी",
    "भोपाल अलग", "bhopal separate", "इंदौर अलग", "indore separate",
    "क्षेत्रीय भेदभाव", "regional discrimination", "केंद्र का विरोध"
  ],

  // Foreign Influence
  "foreign_influence": [
    "पाकिस्तान जिंदाबाद", "pakistan zindabad", "चीन जिंदाबाद", "china zindabad",
    "अमेरिका का समर्थन", "america support", "विदेशी साजिश", "foreign conspiracy",
    "भारत को बेचो", "sell india", "विदेशी एजेंट", "foreign agent"
  ]
};

// Severity levels for anti-national content
const severityLevels = {
  "CRITICAL": {
    "keywords": [...antiNationalKeywords.direct_anti_national, ...antiNationalKeywords.separatist, ...antiNationalKeywords.violence_terrorism],
    "weight": 10,
    "color": "#FF0000", // Red
    "description": "Immediate threat to national security"
  },
  "HIGH": {
    "keywords": [...antiNationalKeywords.anti_constitutional, ...antiNationalKeywords.religious_extremism, ...antiNationalKeywords.anti_security_forces],
    "weight": 8,
    "color": "#FF4500", // Orange Red
    "description": "Serious threat to law and order"
  },
  "MEDIUM": {
    "keywords": [...antiNationalKeywords.economic_sabotage, ...antiNationalKeywords.social_unrest, ...antiNationalKeywords.foreign_influence],
    "weight": 6,
    "color": "#FFA500", // Orange
    "description": "Potential threat to social harmony"
  },
  "LOW": {
    "keywords": [...antiNationalKeywords.regional_discontent],
    "weight": 4,
    "color": "#FFFF00", // Yellow
    "description": "Regional discontent requiring attention"
  }
};

module.exports = {
  antiNationalKeywords,
  severityLevels
};
