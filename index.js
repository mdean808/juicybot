const Discord = require("discord.js");
const mongo = require('mongodb');
const cheerio = require('cheerio');
const request = require('request');
require('dotenv').config();

const juicyBot = new Discord.Client();
const {Util} = require('discord.js');

const botDB = mongo.MongoClient;
const dbUrl = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME;

let users = [];

//dev
//juicyBot.login(process.env.DEV_TOKEN);
// production
juicyBot.login(process.env.PROD_TOKEN);

juicyBot.on('guildMemberAdd', async member => {
	//console.log(member.user.addRole())
});

juicyBot.on('message', async msg => {
		if (msg.author.id === '269167210331766794') return; // return if its da bot
		//if (msg.channel.id === '290482343179845643' || msg.channel.id === '349419472446029845') {
		const userID = users.findIndex(user => user.uid === msg.author.id);

		if (userID > -1) {
			const minutes = Math.abs(new Date().getMinutes() - users[userID].lastChat.getMinutes());
			if (minutes >= 1) {
				users[userID].points += Math.floor(Math.random() * 10) + 5;
				users[userID].lastChat = new Date();
			}
		} else {
			console.log('New User!');
			users.push({
				uid: msg.author.id,
				lastChat: new Date(),
				points: Math.floor(Math.random() * 10) + 5
			});
		}
		if (msg.content.endsWith(' ++')) {
			let karmaData = await incrementKarma(msg.author, msg.mentions.users.array()[0]);
			if (karmaData) msg.channel.send(karmaData);
		}
		if (msg.content.startsWith('!karma')) {
			msg.channel.startTyping();
			if (msg.mentions.users.array().length > 0) {
				const karma = await getKarma(msg.mentions.users.array()[0].id);
				msg.channel.send(msg.guild.members.get(msg.mentions.users.array()[0].id).nickname || msg.mentions.users.array()[0].username + " has " + parseInt(karma) + ' karma.')
			} else {
				const karma = await getKarma(msg.author.id);
				msg.channel.send(msg.guild.members.get(msg.author.id).nickname || msg.author.username + " has " + parseInt(karma) + ' karma.')
			}
			msg.channel.stopTyping();
		}
		if (msg.content.startsWith('!points')) {
			msg.channel.startTyping();
			if (msg.mentions.users.array().length > 0) {
				const points = getPoints(msg.mentions.users.array()[0].id);
				msg.channel.send(msg.guild.members.get(msg.mentions.users.array()[0].id).nickname || msg.mentions.users.array()[0].username + " has " + parseInt(points) + ' chatting points.')
			} else {
				const points = await getPoints(msg.author.id);
				msg.channel.send((msg.guild.members.get(msg.author.id).nickname || msg.author.username) + " has " + parseInt(points) + ' chatting points.')
			}
			msg.channel.stopTyping();
		}
		if (msg.content.startsWith('!ranks')) {
			msg.channel.startTyping();
			let ranks = getRanks(msg.content.split(' ')[1]);
			const embed = new Discord.RichEmbed()
				.setTitle("")
				.setAuthor("Juicy Nation Chatting Ranks")
				.setColor(0xe67e22)
				.setDescription("These are the top " + (ranks.length) + " ranks in the Juicy Nation!")
				.setThumbnail("https://cdn.discordapp.com/icons/290482343179845643/f03ae1ab7863948922d1083c503847d8.webp");
			for (let i = 0; i < ranks.length; i++) {
				embed.addField((msg.guild.members.get(ranks[i].uid).nickname || juicyBot.users.get(ranks[i].uid).username), ranks[i].points + " points")
			}
			msg.channel.send({embed});
			msg.channel.stopTyping();
		}
		if (msg.content.startsWith('!getrank')) {
			msg.channel.startTyping();
			msg.channel.send('You are rank ' + getRank(msg.author.id) + ' out of ' + users.length);
			msg.channel.stopTyping();
		}
		if (msg.content.startsWith('!dd2news') || msg.content.startsWith('!ddanews') || msg.content.startsWith('!ddnews')) {
			try {
				msg.channel.startTyping();
				request('https://forums.dungeondefenders.com/', function (error, response, html) {
					const $ = cheerio.load(html);
					let news = [{
						title: $('.ipsTruncate').text(),
						url: $('.ipsTruncate').attr('href'),
					}];
					for (let i = 0; i < $('.landingStats').first().children().eq(1).children().length; i++) {
						let text = $('.landingStats').first().children().eq(1).children().eq(i).children().first().text();
						let url = $('.landingStats').first().children().eq(1).children().eq(i).children().first().children().first().attr('href');
						news.push({title: text, url: url})
					}
					const embed = new Discord.RichEmbed()
						.setTitle("")
						.setAuthor("Dungeon Defenders News")
						.setColor(0xbd03d4)
						.setDescription("Top news articles from https://dungeondefenders.com")
						.setThumbnail("https://vignette.wikia.nocookie.net/dundef/images/7/70/DunDef_2_Logo.png/revision/latest?cb=20130603230142") //http://favicon.yandex.net/favicon/dungeondefenders.com
						.setFooter("Contact Unicorn if something isn't right.");
					for (let i = 0; i < news.length; i++) {
						embed.addField(news[i].title, news[i].url)
					}
					msg.channel.stopTyping();
					msg.channel.send({embed})
				});
			} catch (e) {
				console.log(e)
				msg.channel.send('There was an error getting the news. Please contact <@247521739398053888>')
				msg.channel.stopTyping();
			}
		}
	}
);

juicyBot.on('warn', console.warn);

juicyBot.on('error', console.error);

juicyBot.on('ready', async () => {
	console.log('Getting JUICY!');
	await loadData();
	setInterval(saveData, 90000);
});

juicyBot.on('disconnect', () => console.log('Just disconnected'));

juicyBot.on('reconnecting', () => console.log('Reconnected!'));

async function incrementKarma(author, user) {
	let database = await botDB.connect(dbUrl, {useNewUrlParser: true});
	let db = database.db(dbName);
	let karma = db.collection('karma');
	if (author.id === user.id) {
		if (await isUserInDB(user.id, 'karma')) {
			await karma.updateOne({uid: user.id}, {$inc: {value: -1}});
		} else {
			await karma.insertOne({uid: user.id, value: -1});
		}
		return "You may not increment your own karma, and as a result you have lost 1 karma."
	} else {
		if (await isUserInDB(user.id, 'karma')) {
			await karma.updateOne({uid: user.id}, {$inc: {value: 1}});
		} else {
			await karma.insertOne({uid: user.id, value: 1});
		}
		return null
	}
}

async function getKarma(uid) {
	let database = await botDB.connect(dbUrl, {useNewUrlParser: true});
	let db = database.db(dbName);
	let karma = db.collection('karma');
	if (!await isUserInDB(uid, 'karma')) {
		await karma.insertOne({uid: uid, value: 0});
	}
	return (await karma.findOne({uid: uid})).value
}

function getPoints(uid) {
	let user = users.filter(user => user.uid === uid)[0];
	if (user) return user.points;
	else return 0;
}

function getRanks(length) {
	function ranking(a, b) {
		if (a.points > b.points) {
			return -1
		}
		if (a.points < b.points) {
			return 1
		}
	}

	let ranks = users.sort(ranking);
	ranks.length = Math.min(ranks.length, (parseInt(length) || 5));
	console.log(ranks.length);
	return ranks
}

function getRank(uid) {
	return getRanks(users.length).findIndex(rank => rank.uid === uid) + 1
}

async function isUserInDB(uid, collection) {
	let database = await botDB.connect(dbUrl, {useNewUrlParser: true});
	let db = database.db(dbName);
	let karma = db.collection(collection);
	return await karma.findOne({uid: uid})
}

async function saveData() {
	let database = await botDB.connect(dbUrl, {useNewUrlParser: true});
	let db = database.db(dbName);
	let points = db.collection('points');
	for (let i = 0; i < users.length; i++) {
		if (!await isUserInDB(users[i].uid, 'points')) {
			await points.insertOne({uid: users[i].uid, points: users[i].points, lastChat: users[i].lastChat});
		} else {
			await points.updateOne({uid: users[i].uid}, {$set: {points: users[i].points}});
		}
	}
}

async function loadData() {
	let database = await botDB.connect(dbUrl, {useNewUrlParser: true});
	let db = database.db(dbName);
	let points = db.collection('points');
	users = await points.find({}).toArray();
}
