// Madhya Pradesh Districts Data for Geo Sentiment Mapping
const mpDistricts = {
  "Bhopal": {
    "id": "bhopal",
    "coordinates": { "lat": 23.2599, "lng": 77.4126 },
    "keywords": ["bhopal", "भोपाल", "bhopal city", "bhopal district"],
    "neighboring": ["Raisen", "Sehore", "Vidisha"]
  },
  "Indore": {
    "id": "indore", 
    "coordinates": { "lat": 22.7196, "lng": 75.8577 },
    "keywords": ["indore", "इंदौर", "indore city", "indore district"],
    "neighboring": ["Dewas", "Ujjain", "Dhar"]
  },
  "Gwalior": {
    "id": "gwalior",
    "coordinates": { "lat": 26.2183, "lng": 78.1828 },
    "keywords": ["gwalior", "ग्वालियर", "gwalior city", "gwalior district"],
    "neighboring": ["Shivpuri", "Datia", "Morena"]
  },
  "Jabalpur": {
    "id": "jabalpur",
    "coordinates": { "lat": 23.1815, "lng": 79.9864 },
    "keywords": ["jabalpur", "जबलपुर", "jabalpur city", "jabalpur district"],
    "neighboring": ["Katni", "Narsinghpur", "Mandla"]
  },
  "Ujjain": {
    "id": "ujjain",
    "coordinates": { "lat": 23.1765, "lng": 75.7885 },
    "keywords": ["ujjain", "उज्जैन", "ujjain city", "ujjain district"],
    "neighboring": ["Indore", "Dewas", "Ratlam"]
  },
  "Sagar": {
    "id": "sagar",
    "coordinates": { "lat": 23.8338, "lng": 78.7164 },
    "keywords": ["sagar", "सागर", "sagar city", "sagar district"],
    "neighboring": ["Damoh", "Tikamgarh", "Chhatarpur"]
  },
  "Rewa": {
    "id": "rewa",
    "coordinates": { "lat": 24.5323, "lng": 81.2924 },
    "keywords": ["rewa", "रीवा", "rewa city", "rewa district"],
    "neighboring": ["Satna", "Sidhi", "Shahdol"]
  },
  "Satna": {
    "id": "satna",
    "coordinates": { "lat": 24.5943, "lng": 80.8321 },
    "keywords": ["satna", "सतना", "satna city", "satna district"],
    "neighboring": ["Rewa", "Panna", "Chhatarpur"]
  },
  "Morena": {
    "id": "morena",
    "coordinates": { "lat": 26.4969, "lng": 78.0003 },
    "keywords": ["morena", "मुरैना", "morena city", "morena district"],
    "neighboring": ["Gwalior", "Bhind", "Sheopur"]
  },
  "Bhind": {
    "id": "bhind",
    "coordinates": { "lat": 26.5649, "lng": 78.7873 },
    "keywords": ["bhind", "भिंड", "bhind city", "bhind district"],
    "neighboring": ["Morena", "Datia", "Gwalior"]
  },
  "Chhatarpur": {
    "id": "chhatarpur",
    "coordinates": { "lat": 24.7136, "lng": 79.6904 },
    "keywords": ["chhatarpur", "छतरपुर", "chhatarpur city", "chhatarpur district"],
    "neighboring": ["Sagar", "Tikamgarh", "Panna"]
  },
  "Panna": {
    "id": "panna",
    "coordinates": { "lat": 24.7136, "lng": 80.1904 },
    "keywords": ["panna", "पन्ना", "panna city", "panna district"],
    "neighboring": ["Chhatarpur", "Satna", "Damoh"]
  },
  "Damoh": {
    "id": "damoh",
    "coordinates": { "lat": 23.8338, "lng": 79.4414 },
    "keywords": ["damoh", "दमोह", "damoh city", "damoh district"],
    "neighboring": ["Sagar", "Panna", "Katni"]
  },
  "Katni": {
    "id": "katni",
    "coordinates": { "lat": 23.8338, "lng": 80.4074 },
    "keywords": ["katni", "कटनी", "katni city", "katni district"],
    "neighboring": ["Damoh", "Jabalpur", "Umaria"]
  },
  "Umaria": {
    "id": "umaria",
    "coordinates": { "lat": 23.5246, "lng": 80.8374 },
    "keywords": ["umaria", "उमरिया", "umaria city", "umaria district"],
    "neighboring": ["Katni", "Shahdol", "Anuppur"]
  },
  "Shahdol": {
    "id": "shahdol",
    "coordinates": { "lat": 23.2956, "lng": 81.3564 },
    "keywords": ["shahdol", "शहडोल", "shahdol city", "shahdol district"],
    "neighboring": ["Umaria", "Anuppur", "Sidhi"]
  },
  "Sidhi": {
    "id": "sidhi",
    "coordinates": { "lat": 24.4136, "lng": 81.8824 },
    "keywords": ["sidhi", "सीधी", "sidhi city", "sidhi district"],
    "neighboring": ["Shahdol", "Rewa", "Singrauli"]
  },
  "Singrauli": {
    "id": "singrauli",
    "coordinates": { "lat": 24.1973, "lng": 82.6754 },
    "keywords": ["singrauli", "सिंगरौली", "singrauli city", "singrauli district"],
    "neighboring": ["Sidhi", "Sonbhadra"]
  },
  "Anuppur": {
    "id": "anuppur",
    "coordinates": { "lat": 23.1036, "lng": 81.6904 },
    "keywords": ["anuppur", "अनूपपुर", "anuppur city", "anuppur district"],
    "neighboring": ["Shahdol", "Umaria", "Dindori"]
  },
  "Dindori": {
    "id": "dindori",
    "coordinates": { "lat": 22.9536, "lng": 81.0904 },
    "keywords": ["dindori", "डिंडोरी", "dindori city", "dindori district"],
    "neighboring": ["Anuppur", "Mandla", "Balaghat"]
  },
  "Mandla": {
    "id": "mandla",
    "coordinates": { "lat": 22.5936, "lng": 80.3704 },
    "keywords": ["mandla", "मंडला", "mandla city", "mandla district"],
    "neighboring": ["Dindori", "Jabalpur", "Seoni"]
  },
  "Seoni": {
    "id": "seoni",
    "coordinates": { "lat": 22.0836, "lng": 79.5504 },
    "keywords": ["seoni", "सिवनी", "seoni city", "seoni district"],
    "neighboring": ["Mandla", "Balaghat", "Chhindwara"]
  },
  "Balaghat": {
    "id": "balaghat",
    "coordinates": { "lat": 21.8036, "lng": 80.1904 },
    "keywords": ["balaghat", "बालाघाट", "balaghat city", "balaghat district"],
    "neighboring": ["Seoni", "Chhindwara", "Gondia"]
  },
  "Chhindwara": {
    "id": "chhindwara",
    "coordinates": { "lat": 22.0536, "lng": 78.9504 },
    "keywords": ["chhindwara", "छिंदवाड़ा", "chhindwara city", "chhindwara district"],
    "neighboring": ["Balaghat", "Seoni", "Betul"]
  },
  "Betul": {
    "id": "betul",
    "coordinates": { "lat": 21.9036, "lng": 77.8904 },
    "keywords": ["betul", "बैतूल", "betul city", "betul district"],
    "neighboring": ["Chhindwara", "Hoshangabad", "Harda"]
  },
  "Harda": {
    "id": "harda",
    "coordinates": { "lat": 22.3336, "lng": 77.0904 },
    "keywords": ["harda", "हरदा", "harda city", "harda district"],
    "neighboring": ["Betul", "Hoshangabad", "Sehore"]
  },
  "Hoshangabad": {
    "id": "hoshangabad",
    "coordinates": { "lat": 22.7536, "lng": 77.7204 },
    "keywords": ["hoshangabad", "होशंगाबाद", "hoshangabad city", "hoshangabad district"],
    "neighboring": ["Harda", "Betul", "Raisen"]
  },
  "Raisen": {
    "id": "raisen",
    "coordinates": { "lat": 23.3336, "lng": 77.7904 },
    "keywords": ["raisen", "रायसेन", "raisen city", "raisen district"],
    "neighboring": ["Hoshangabad", "Bhopal", "Vidisha"]
  },
  "Vidisha": {
    "id": "vidisha",
    "coordinates": { "lat": 23.5236, "lng": 77.8104 },
    "keywords": ["vidisha", "विदिशा", "vidisha city", "vidisha district"],
    "neighboring": ["Raisen", "Bhopal", "Sagar"]
  },
  "Sehore": {
    "id": "sehore",
    "coordinates": { "lat": 23.2036, "lng": 77.0904 },
    "keywords": ["sehore", "सीहोर", "sehore city", "sehore district"],
    "neighboring": ["Harda", "Bhopal", "Raisen"]
  },
  "Dewas": {
    "id": "dewas",
    "coordinates": { "lat": 22.9636, "lng": 76.0504 },
    "keywords": ["dewas", "देवास", "dewas city", "dewas district"],
    "neighboring": ["Indore", "Ujjain", "Shajapur"]
  },
  "Shajapur": {
    "id": "shajapur",
    "coordinates": { "lat": 23.4336, "lng": 76.2604 },
    "keywords": ["shajapur", "शाजापुर", "shajapur city", "shajapur district"],
    "neighboring": ["Dewas", "Ujjain", "Rajgarh"]
  },
  "Rajgarh": {
    "id": "rajgarh",
    "coordinates": { "lat": 24.0036, "lng": 76.7204 },
    "keywords": ["rajgarh", "राजगढ़", "rajgarh city", "rajgarh district"],
    "neighboring": ["Shajapur", "Biaora", "Vidisha"]
  },
  "Dhar": {
    "id": "dhar",
    "coordinates": { "lat": 22.6036, "lng": 75.3004 },
    "keywords": ["dhar", "धार", "dhar city", "dhar district"],
    "neighboring": ["Indore", "Jhabua", "Barwani"]
  },
  "Jhabua": {
    "id": "jhabua",
    "coordinates": { "lat": 22.7636, "lng": 74.5904 },
    "keywords": ["jhabua", "झाबुआ", "jhabua city", "jhabua district"],
    "neighboring": ["Dhar", "Barwani", "Alirajpur"]
  },
  "Alirajpur": {
    "id": "alirajpur",
    "coordinates": { "lat": 22.3036, "lng": 74.3604 },
    "keywords": ["alirajpur", "अलीराजपुर", "alirajpur city", "alirajpur district"],
    "neighboring": ["Jhabua", "Barwani", "Dhar"]
  },
  "Barwani": {
    "id": "barwani",
    "coordinates": { "lat": 22.0336, "lng": 74.9004 },
    "keywords": ["barwani", "बड़वानी", "barwani city", "barwani district"],
    "neighboring": ["Alirajpur", "Dhar", "Khargone"]
  },
  "Khargone": {
    "id": "khargone",
    "coordinates": { "lat": 21.8236, "lng": 75.6104 },
    "keywords": ["khargone", "खरगोन", "khargone city", "khargone district"],
    "neighboring": ["Barwani", "Burhanpur", "Khandwa"]
  },
  "Burhanpur": {
    "id": "burhanpur",
    "coordinates": { "lat": 21.3036, "lng": 76.2304 },
    "keywords": ["burhanpur", "बुरहानपुर", "burhanpur city", "burhanpur district"],
    "neighboring": ["Khargone", "Khandwa", "Betul"]
  },
  "Khandwa": {
    "id": "khandwa",
    "coordinates": { "lat": 21.8236, "lng": 76.3304 },
    "keywords": ["khandwa", "खंडवा", "khandwa city", "khandwa district"],
    "neighboring": ["Burhanpur", "Khargone", "Harda"]
  },
  "Narsinghpur": {
    "id": "narsinghpur",
    "coordinates": { "lat": 22.9536, "lng": 79.1904 },
    "keywords": ["narsinghpur", "नरसिंहपुर", "narsinghpur city", "narsinghpur district"],
    "neighboring": ["Jabalpur", "Chhindwara", "Seoni"]
  },
  "Tikamgarh": {
    "id": "tikamgarh",
    "coordinates": { "lat": 24.7436, "lng": 78.8304 },
    "keywords": ["tikamgarh", "टीकमगढ़", "tikamgarh city", "tikamgarh district"],
    "neighboring": ["Chhatarpur", "Sagar", "Chhatarpur"]
  },
  "Datia": {
    "id": "datia",
    "coordinates": { "lat": 25.6736, "lng": 78.4604 },
    "keywords": ["datia", "दतिया", "datia city", "datia district"],
    "neighboring": ["Gwalior", "Bhind", "Jhansi"]
  },
  "Shivpuri": {
    "id": "shivpuri",
    "coordinates": { "lat": 25.4236, "lng": 77.6504 },
    "keywords": ["shivpuri", "शिवपुरी", "shivpuri city", "shivpuri district"],
    "neighboring": ["Gwalior", "Guna", "Sheopur"]
  },
  "Guna": {
    "id": "guna",
    "coordinates": { "lat": 24.6536, "lng": 77.3104 },
    "keywords": ["guna", "गुना", "guna city", "guna district"],
    "neighboring": ["Shivpuri", "Ashoknagar", "Vidisha"]
  },
  "Ashoknagar": {
    "id": "ashoknagar",
    "coordinates": { "lat": 24.5836, "lng": 77.7304 },
    "keywords": ["ashoknagar", "अशोकनगर", "ashoknagar city", "ashoknagar district"],
    "neighboring": ["Guna", "Vidisha", "Sagar"]
  },
  "Sheopur": {
    "id": "sheopur",
    "coordinates": { "lat": 25.6736, "lng": 76.7004 },
    "keywords": ["sheopur", "श्योपुर", "sheopur city", "sheopur district"],
    "neighboring": ["Shivpuri", "Morena", "Karauli"]
  },
  "Ratlam": {
    "id": "ratlam",
    "coordinates": { "lat": 23.3336, "lng": 75.0404 },
    "keywords": ["ratlam", "रतलाम", "ratlam city", "ratlam district"],
    "neighboring": ["Ujjain", "Mandsaur", "Neemuch"]
  },
  "Mandsaur": {
    "id": "mandsaur",
    "coordinates": { "lat": 24.0736, "lng": 75.0804 },
    "keywords": ["mandsaur", "मंदसौर", "mandsaur city", "mandsaur district"],
    "neighboring": ["Ratlam", "Neemuch", "Jhalawar"]
  },
  "Neemuch": {
    "id": "neemuch",
    "coordinates": { "lat": 24.4736, "lng": 74.8704 },
    "keywords": ["neemuch", "नीमच", "neemuch city", "neemuch district"],
    "neighboring": ["Mandsaur", "Chittorgarh", "Mandsaur"]
  }
};

module.exports = mpDistricts;
