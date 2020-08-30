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
	anilist_id: String,
	mal_id: String,
});
module.exports.Server = mongoose.model(
	'Server',
	new Schema({
		server_id: String,
		//serverName: String,
		config: {
			prefix: String,
			mod_role_id: String,
		},
		anime_queue: [module.exports.AnimeEntryObject],
	})
);

module.exports.get_user_proposal = function (server, user_id) {
	return server.anime_queue.find(
		(anime_entry) =>
			anime_entry.watched == false && anime_entry.user_id == user_id
	);
};

module.exports.get_user_watched_proposals = function (server, user_id) {
	return server.anime_queue.filter(
		(anime_entry) =>
			anime_entry.watched == true && anime_entry.user_id == user_id
	);
};

module.exports.get_server_proposals = function (server) {
	return server.anime_queue.filter(
		(anime_entry) => anime_entry.watched == false
	);
};
