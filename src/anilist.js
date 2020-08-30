const axios = require('axios');

module.exports.search_anilist = async function (title, page, perPage) {
	const url = 'https://graphql.anilist.co/';
	const query = `query ($search: String, $page: Int, $perPage: Int) {
			Page(page: $page, perPage: $perPage) {
				pageInfo {
					total
					currentPage
				}
				media(search: $search, type: ANIME, sort: START_DATE) {
					id
					idMal
					startDate {
						year
						month
						day
					}
					title {
						english(stylised: true)
						romaji(stylised: true)
					}
				}
			}
		}
		`;
	const res = await axios
		.post(url, {
			query,
			variables: {
				search: title,
				page: page || 1,
				perPage: perPage || 10,
			},
		})
		.catch(console.log);
	return res.data.data.Page;
};

module.exports.get_anilist_media_by_id = async function (anilist_id) {
	const url = 'https://graphql.anilist.co/';
	const query = `query ($anilist_id: Int) {
			Media(id: $anilist_id, type: ANIME) {
				id
				idMal
				startDate {
					year
					month
					day
				}
				title {
					english(stylised: true)
					romaji(stylised: true)
				}
			}
		}
		`;
	const res = await axios
		.post(url, {
			query,
			variables: {
				anilist_id,
			},
		})
		.catch(console.log);
	return res.data.data.Media;
};

module.exports.get_anilist_media_by_mal_id = async function (mal_id) {
	const url = 'https://graphql.anilist.co/';
	const query = `query ($mal_id: Int) {
			Media(idMal: $mal_id, type: ANIME) {
				id
				idMal
				startDate {
					year
					month
					day
				}
				title {
					english(stylised: true)
					romaji(stylised: true)
				}
			}
		}
		`;
	const res = await axios
		.post(url, {
			query,
			variables: {
				mal_id,
			},
		})
		.catch(console.log);
	return res.data.data.Media;
};

module.exports.proposal_from_anilist_media = function (msg, media) {
	return {
		votes: [],
		user_id: msg.author.id,
		date_proposed: Date.now(),
		date_watched: null,
		watched: false,
		title: media.title.english || media.title.romaji,
		anilist_id: media.id,
		mal_id: media.idMal,
	};
};
