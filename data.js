/* 中学1年生のための５分英単語 — 単元と語彙 */
const UNITS = [
  { id: "greetings", name: "あいさつ", blurb: "毎日つかうことば" },
  { id: "people", name: "自分と相手", blurb: "I / you / he / she" },
  { id: "school", name: "学校", blurb: "教室でよく出る語" },
  { id: "weather", name: "天気と気分", blurb: "きょうの天気・きもち" },
  { id: "wh", name: "疑問詞", blurb: "what / where / who" },
  { id: "around", name: "身のまわり", blurb: "家族・動物・もの" },
];

const WORDS = [
  // あいさつ
  { id: "hello", unit: "greetings", en: "Hello", ja: "こんにちは", exampleEn: "Hello, I'm Yumi.", exampleJa: "こんにちは、ユミです。" },
  { id: "thank-you", unit: "greetings", en: "Thank you", ja: "ありがとう", exampleEn: "Thank you very much.", exampleJa: "どうもありがとう。" },
  { id: "excuse-me", unit: "greetings", en: "Excuse me", ja: "すみません", exampleEn: "Excuse me.", exampleJa: "すみません。" },
  { id: "im-sorry", unit: "greetings", en: "I'm sorry", ja: "ごめんなさい", exampleEn: "I'm sorry.", exampleJa: "ごめんなさい。" },
  { id: "good-morning", unit: "greetings", en: "Good morning", ja: "おはよう", exampleEn: "Good morning, everyone.", exampleJa: "みなさん、おはよう。" },
  { id: "good-night", unit: "greetings", en: "Good night", ja: "おやすみなさい", exampleEn: "Good night.", exampleJa: "おやすみなさい。" },
  { id: "nice-to-meet-you", unit: "greetings", en: "Nice to meet you", ja: "はじめまして", exampleEn: "Nice to meet you.", exampleJa: "はじめまして。" },
  { id: "how-are-you", unit: "greetings", en: "How are you?", ja: "お元気ですか", exampleEn: "How are you?", exampleJa: "げんきですか。" },
  { id: "please", unit: "greetings", en: "Please", ja: "お願いします", exampleEn: "Please sit down.", exampleJa: "すわってください。" },

  // 自分と相手
  { id: "i", unit: "people", en: "I", ja: "私は", exampleEn: "I am a student.", exampleJa: "私は生徒です。" },
  { id: "my", unit: "people", en: "my", ja: "私の", exampleEn: "This is my book.", exampleJa: "これは私の本です。" },
  { id: "you", unit: "people", en: "you", ja: "あなたは", exampleEn: "You are my friend.", exampleJa: "あなたは友だちです。" },
  { id: "your", unit: "people", en: "your", ja: "あなたの", exampleEn: "What's your name?", exampleJa: "あなたの名前は？" },
  { id: "he", unit: "people", en: "he", ja: "彼は", exampleEn: "He is a teacher.", exampleJa: "彼は先生です。" },
  { id: "his", unit: "people", en: "his", ja: "彼の", exampleEn: "This is his pen.", exampleJa: "これは彼のペンです。" },
  { id: "she", unit: "people", en: "she", ja: "彼女は", exampleEn: "She is happy.", exampleJa: "彼女はうれしそうです。" },
  { id: "her", unit: "people", en: "her", ja: "彼女の", exampleEn: "This is her desk.", exampleJa: "これは彼女の机です。" },
  { id: "we", unit: "people", en: "we", ja: "私たちは", exampleEn: "We are students.", exampleJa: "私たちは生徒です。" },
  { id: "they", unit: "people", en: "they", ja: "彼らは", exampleEn: "They are friends.", exampleJa: "彼らは友だちです。" },

  // 学校
  { id: "school", unit: "school", en: "school", ja: "学校", exampleEn: "I like school.", exampleJa: "学校が好きです。" },
  { id: "student", unit: "school", en: "student", ja: "生徒", exampleEn: "I am a student.", exampleJa: "私は生徒です。" },
  { id: "teacher", unit: "school", en: "teacher", ja: "先生", exampleEn: "Ms. Green is my teacher.", exampleJa: "グリーン先生は私の先生です。" },
  { id: "friend", unit: "school", en: "friend", ja: "友だち", exampleEn: "Ken is my friend.", exampleJa: "ケンは友だちです。" },
  { id: "book", unit: "school", en: "book", ja: "本", exampleEn: "This is an English book.", exampleJa: "これは英語の本です。" },
  { id: "pen", unit: "school", en: "pen", ja: "ペン", exampleEn: "I have a pen.", exampleJa: "ペンを持っています。" },
  { id: "desk", unit: "school", en: "desk", ja: "机", exampleEn: "This is my desk.", exampleJa: "これは私の机です。" },
  { id: "name", unit: "school", en: "name", ja: "名前", exampleEn: "My name is Aki.", exampleJa: "名前はアキです。" },
  { id: "english", unit: "school", en: "English", ja: "英語", exampleEn: "I like English.", exampleJa: "英語が好きです。" },
  { id: "classroom", unit: "school", en: "classroom", ja: "教室", exampleEn: "This is our classroom.", exampleJa: "これが私たちの教室です。" },

  // 天気と気分
  { id: "sunny", unit: "weather", en: "sunny", ja: "晴れている", exampleEn: "It's sunny today.", exampleJa: "きょうは晴れです。" },
  { id: "cloudy", unit: "weather", en: "cloudy", ja: "曇っている", exampleEn: "It's cloudy.", exampleJa: "くもりです。" },
  { id: "rainy", unit: "weather", en: "rainy", ja: "雨が降っている", exampleEn: "It's rainy today.", exampleJa: "きょうは雨です。" },
  { id: "snowy", unit: "weather", en: "snowy", ja: "雪が降っている", exampleEn: "It's snowy.", exampleJa: "雪です。" },
  { id: "hot", unit: "weather", en: "hot", ja: "暑い", exampleEn: "It's hot today.", exampleJa: "きょうは暑いです。" },
  { id: "cold", unit: "weather", en: "cold", ja: "寒い", exampleEn: "It's cold.", exampleJa: "寒いです。" },
  { id: "happy", unit: "weather", en: "happy", ja: "うれしい", exampleEn: "I am happy.", exampleJa: "うれしいです。" },
  { id: "sad", unit: "weather", en: "sad", ja: "悲しい", exampleEn: "She is sad.", exampleJa: "彼女は悲しそうです。" },

  // 疑問詞
  { id: "what", unit: "wh", en: "what", ja: "何", exampleEn: "What is this?", exampleJa: "これは何ですか。" },
  { id: "where", unit: "wh", en: "where", ja: "どこ", exampleEn: "Where is my book?", exampleJa: "本はどこ？" },
  { id: "when", unit: "wh", en: "when", ja: "いつ", exampleEn: "When is your birthday?", exampleJa: "誕生日はいつ？" },
  { id: "who", unit: "wh", en: "who", ja: "誰", exampleEn: "Who is he?", exampleJa: "彼は誰ですか。" },
  { id: "whose", unit: "wh", en: "whose", ja: "誰の", exampleEn: "Whose pen is this?", exampleJa: "これは誰のペン？" },
  { id: "which", unit: "wh", en: "which", ja: "どの", exampleEn: "Which do you like?", exampleJa: "どっちが好き？" },
  { id: "how", unit: "wh", en: "how", ja: "どのように", exampleEn: "How are you?", exampleJa: "げんきですか。" },
  { id: "why", unit: "wh", en: "why", ja: "なぜ", exampleEn: "Why?", exampleJa: "どうして？" },

  // 身のまわり
  { id: "dog", unit: "around", en: "dog", ja: "犬", exampleEn: "I have a dog.", exampleJa: "犬を飼っています。" },
  { id: "cat", unit: "around", en: "cat", ja: "猫", exampleEn: "This is my cat.", exampleJa: "これは私の猫です。" },
  { id: "apple", unit: "around", en: "apple", ja: "りんご", exampleEn: "I like apples.", exampleJa: "りんごが好きです。" },
  { id: "water", unit: "around", en: "water", ja: "水", exampleEn: "I want water.", exampleJa: "水がほしいです。" },
  { id: "food", unit: "around", en: "food", ja: "食べ物", exampleEn: "The food is good.", exampleJa: "食べ物がおいしいです。" },
  { id: "mother", unit: "around", en: "mother", ja: "母", exampleEn: "This is my mother.", exampleJa: "こちらは母です。" },
  { id: "father", unit: "around", en: "father", ja: "父", exampleEn: "My father is a teacher.", exampleJa: "父は先生です。" },
  { id: "this", unit: "around", en: "this", ja: "これ", exampleEn: "This is a book.", exampleJa: "これは本です。" },
  { id: "that", unit: "around", en: "that", ja: "あれ", exampleEn: "That is a pen.", exampleJa: "あれはペンです。" },
  { id: "house", unit: "around", en: "house", ja: "家", exampleEn: "This is my house.", exampleJa: "これがうちです。" },
];

const ONBOARD_IDS = ["hello", "thank-you", "dog"];
const SESSION_SIZE = 8;
const MASTER_BOX = 2;
const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7 };
