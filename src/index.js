require('dotenv').config();

const char_to_emoji = require('./emoji_characters');
const { weighted_roll, days_since_date, pretty_date } = require('./utils');
const {
	search_anilist,
	get_anilist_media_by_id,
	get_anilist_media_by_mal_id,
	proposal_from_anilist_media,
} = require('./anilist');

const emoji_to_char = Object.entries(char_to_emoji).reduce((ret, entry) => {
	ret[entry.value] = entry.key;
	return ret;
}, {});
const Discord = require('discord.js');
const {
	mongoose,
	Server,
	get_user_proposal,
	get_user_watched_proposals,
	get_server_proposals,
} = require('./db.js');

const DEFAULT_PREFIX = '|';
const BASE_ROLL_WEIGHT = 1;

async function ensure_guild_initialization(guild) {
	const server = await Server.find({ serverId: guild.id }).exec();
	if (server[0] == null) {
		await Server.create({
			server_id: guild.id,
			config: { prefix: DEFAULT_PREFIX, mod_role_id: null },
			anime_queue: [],
		});
	}
}

function is_admin(member) {
	return member.hasPermission('ADMINISTRATOR');
}

async function is_mod(member, server) {
	if (server == null) {
		server = await Server.find({ serverId: member.guild.id }).exec();
	}
	return (
		is_admin(member) ||
		member.roles.cache.find((role) => role.id === server.config.mod_role_id)
	);
}

function modcommand_wrapper(fn) {
	return async function (server, msg, args) {
		if (await is_mod(msg.member, server)) {
			fn(server, msg, args);
		} else {
			msg.reply("You're not a mod!");
		}
	};
}

async function validate_conflicting_anime_entry(msg, server, filter) {
	const conflicting_anime_entry = server.anime_queue.find(filter);
	if (conflicting_anime_entry != null) {
		const member_who_already_proposed = await msg.guild.members.fetch(
			conflicting_anime_entry.user_id
		);
		//TODO: What do if member left server?
		msg.reply(
			`${conflicting_anime_entry.title} has already been proposed by ${
				member_who_already_proposed.nickname ||
				member_who_already_proposed.user.username
			}`
		);
		return true;
	}
	return false;
}
const client = new Discord.Client();

const commands = {
	setprefix: modcommand_wrapper(async function (server, msg, args) {
		const new_prefix = args[0];
		if (new_prefix != null && new_prefix.length == 1) {
			server.config.prefix = new_prefix;
			msg.reply(`Prefix set to ${new_prefix}`);
			server.save();
		} else {
			msg.reply(
				`${new_prefix} is not a valid prefix! It must be a single character`
			);
		}
	}),
	roll: modcommand_wrapper(async function (server, msg, args) {
		const proposals = get_server_proposals(server);
		if (proposals.length == 0) {
			msg.reply('There are no proposals to roll from!');
			return;
		}

		const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
		const now = Date.now();
		let weights = proposals.map(
			(proposal) =>
				BASE_ROLL_WEIGHT +
				Math.floor(days_since_date(proposal.date_proposed) / 7)
		);

		var rolled_proposal = weighted_roll(proposals, weights);

		msg.reply(rolled_proposal.title);
		rolled_proposal.watched = true;
		rolled_proposal.date_watched = Date.now();
		server.save();
	}),
	myproposal: async function (server, msg, args) {
		const existing_proposal = get_user_proposal(server, msg.author.id);
		if (existing_proposal != null) {
			msg.reply(
				`Your active proposal is ${existing_proposal.title} (${pretty_date(
					existing_proposal.date_proposed
				)})`
			);
		} else {
			msg.reply(`You do not have an active proposal`);
		}
	},
	propose: async function (server, msg, args) {
		const title = msg.content.substr(msg.content.indexOf(' ') + 1);
		if (title == null || title.length == 0) {
			msg.reply(`Missing anime title`);
			return;
		}

		const existing_proposal = get_user_proposal(server, msg.author.id);
		if (existing_proposal) {
			msg.reply(`You have already proposed ${existing_proposal.title}`);
			return;
		}

		const anilist_prefix = 'anilist.co/anime/';
		const anilist_suffix = '/';
		if (title.includes(anilist_prefix)) {
			const prefix_end_idx =
				title.indexOf(anilist_prefix) + anilist_prefix.length;
			let anilist_id = title.substring(
				prefix_end_idx,
				title.indexOf(anilist_suffix, prefix_end_idx)
			);

			const anilist_media = await get_anilist_media_by_id(anilist_id);
			const proposal = proposal_from_anilist_media(msg, anilist_media);

			if (
				await validate_conflicting_anime_entry(
					msg,
					server,
					(anime_entry) => anime_entry.anilist_id == proposal.anilist_id
				)
			) {
				return;
			}

			server.anime_queue.push(proposal);
			server.save();

			msg.reply(`Your proposal is now set to ${proposal.title}`);
			return;
		}

		const mal_prefix = 'myanimelist.net/anime/';
		const mal_suffix = '/';
		if (title.includes(mal_prefix)) {
			const prefix_end_idx = title.indexOf(mal_prefix) + mal_prefix.length;
			let mal_id = title.substring(
				prefix_end_idx,
				title.indexOf(mal_suffix, prefix_end_idx)
			);

			const mal_media = await get_anilist_media_by_mal_id(mal_id);
			const proposal = proposal_from_anilist_media(msg, mal_media);

			if (
				await validate_conflicting_anime_entry(
					msg,
					server,
					(anime_entry) => anime_entry.anilist_id == proposal.anilist_id
				)
			) {
				return;
			}

			server.anime_queue.push(proposal);
			server.save();

			msg.reply(`Your proposal is now set to ${proposal.title}`);
			return;
		}

		// dummy condition to avoid eslint warn
		if (msg != null) {
			msg.reply(`Anilist search and reaction choice is not supported yet`);
			return;
		}

		const res_page = await search_anilist(title, 1, 10);
		// TODO: Make this message pretty and react with number emojis
		// TODO: Pagination (React with prev/next emojis, allow them in the collector,
		//       and handle them to query the next/prev page from anilist and edit the message)
		const list_msg = await msg.channel.send(
			new Discord.MessageEmbed().setTitle(`Results for '${title}'`).addFields(
				res_page.media.map((media) => {
					return {
						name: media.title.english || media.title.romaji,
						value: 'x',
					};
				})
			)
		);

		const filter = (reaction, user) => {
			const char = emoji_to_char[reaction.emoji.name];
			//TODO: Allow prev/next emojis
			return user.id == msg.author.id && char != null && Number.isInteger(char);
		};

		list_msg
			.awaitReactions(filter, { max: 1, time: 15000, errors: ['time'] })
			.then((collected) => {
				//TODO: Get the corresponding anilist media from the search response
				//      and make the proposal from that
				//TODO: Will probably also have to check for next/prev page emoji reactions here
				const proposal = {
					votes: [],
					user_id: msg.author.id,
					date_proposed: Date.now(),
					date_watched: null,
					watched: false,
					title: title,
					anilist_id: null,
					mal_id: null,
				};
				server.anime_queue.push(proposal);
				server.save();

				msg.reply(`Your proposal is now set to ${title}`);
			})
			.catch((collected) => {
				msg.reply(`Selection timed out!`);
			});
	},
};

async function run() {
	try {
		await mongoose
			.connect(process.env.M_URI, { useUnifiedTopology: true })
			.catch((error) => {
				console.log(`Error connecting to mongodb: ${error}`);
				process.exit();
			});
		console.log('Succesfully connected to mongo database!');

		client.on('ready', async () => {
			console.log(`Logged in as ${client.user.tag}!`);

			await Promise.all(client.guilds.cache.map(ensure_guild_initialization));
		});
		client.on('guildCreate', async ({ guild }) => {
			await ensure_guild_initialization(guild);
		});

		client.on('message', async (msg) => {
			const [server] = await Server.find({ serverId: msg.guild.id }).exec();
			const prefix = server.config.prefix;
			if (!msg.content.startsWith(prefix) || msg.author.bot) return;

			const args = msg.content.slice(prefix.length).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // lowercase and shift() to remove prefix

			const command_fn = commands[command];
			if (command_fn != null) {
				command_fn(server, msg, args);
			}
		});

		await client.login(process.env.D_TOKEN);
		console.log('Succesfully initialized discord bot!');
	} catch (error) {
		console.log(`Error: ${error}`);
		process.exit();
		throw error;
	}
}
run().catch(console.dir);
