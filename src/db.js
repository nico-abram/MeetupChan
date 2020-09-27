const mongoose = require('mongoose');

module.exports.mongoose = mongoose;
var Schema = module.exports.mongoose.Schema;

module.exports.AnimeEntryObject = new Schema({
	votes: [{ user_id: String, score: Number }],
	user_id: String,
	date_proposed: Date,
	date_watched: Date, // Null if not watched
	watched: Boolean,
	title: String,
	anilist_id: Number,
	mal_id: Number,
});

const Server = mongoose.model(
	'Server',
	new Schema({
		server_id: String,
		//serverName: String,
		config: {
			prefix: String,
			mod_role_ids: [String],
			voice_channel_ids: [String],
			base_roll_weight: Number,
		},
		anime_queue: [module.exports.AnimeEntryObject],
		removed_proposals: [module.exports.AnimeEntryObject],
	})
);
module.exports.Server = Server;

module.exports.get_user_proposal = async function (server, user_id) {
	return (
		await Server.aggregate([
			{ $match: { server_id: server.server_id } },
			{ $unwind: '$anime_queue' },
			{ $replaceRoot: { newRoot: '$anime_queue' } },
			{
				$match: { user_id: user_id, watched: false },
			},
		]).exec()
	)[0];
};

module.exports.get_user_watched_proposals = async function (server, user_id) {
	return await Server.aggregate([
		{ $match: { server_id: server.server_id } },
		{ $unwind: '$anime_queue' },
		{ $replaceRoot: { newRoot: '$anime_queue' } },
		{
			$match: { user_id: user_id, watched: true },
		},
	]).exec();
};

module.exports.get_server_unwatched_proposals = async function (server) {
	return await Server.aggregate([
		{ $match: { server_id: server.server_id } },
		{ $unwind: '$anime_queue' },
		{ $replaceRoot: { newRoot: '$anime_queue' } },
		{
			$match: { watched: false },
		},
	]).exec();
};

module.exports.get_proposal_from_anilist_id = async function (
	server,
	anilist_id
) {
	return (
		await Server.aggregate([
			{ $match: { server_id: server.server_id } },
			{ $unwind: '$anime_queue' },
			{ $replaceRoot: { newRoot: '$anime_queue' } },
			{
				$match: { anilist_id },
			},
		]).exec()
	)[0];
};

module.exports.get_most_recent_watched_proposal = async function (server) {
	return (
		await Server.aggregate([
			{ $match: { server_id: server.server_id } },
			{ $unwind: '$anime_queue' },
			{ $replaceRoot: { newRoot: '$anime_queue' } },
			{ $sort: { date_watched: -1 } },
			{ $limit: 1 },
		]).exec()
	)[0];
};

module.exports.remove_proposal = async function (server, proposal_to_remove) {
	await Server.updateOne(
		{ server_id: server.server_id },
		{ $pull: { anime_queue: { anilist_id: proposal_to_remove.anilist_id } } }
	).exec();
};

module.exports.add_proposal = async function (server, proposal) {
	await Server.update(
		{ server_id: server.server_id },
		{ $push: { anime_queue: proposal } }
	).exec();
};

module.exports.remove_proposal = async function (server, proposal_to_remove) {
	await Server.updateOne(
		{ server_id: server.server_id },
		{ $pull: { anime_queue: { anilist_id: proposal_to_remove.anilist_id } } }
	).exec();
	await Server.update(
		{ server_id: server.server_id },
		{ $push: { removed_proposals: proposal_to_remove } }
	).exec();
};

module.exports.save_proposal = async function (server, proposal) {
	await Server.update(
		{
			server_id: server.server_id,
			'anime_queue.anilist_id': proposal.anilist_id,
		},
		{
			$set: {
				'anime_queue.$': proposal,
			},
		}
	).exec();
};

module.exports.get_server_without_anime_queue = async function (server_id) {
	return (await Server.find({ server_id }, 'server_id config').exec())[0];
};
