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

async function get_anilist_media_by_id(anilist_id) {
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
}
module.exports.get_anilist_media_by_id = get_anilist_media_by_id;

async function get_anilist_media_by_mal_id(mal_id) {
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
}
module.exports.get_anilist_media_by_mal_id = get_anilist_media_by_mal_id;

module.exports.get_anilist_url_and_thumbnail_url_by_anilist_id = async function (
	anilist_id
) {
	const url = 'https://graphql.anilist.co/';
	const query = `query ($anilist_id: Int) {
			Media(id: $anilist_id, type: ANIME) {
				coverImage {
					large
				}
				siteUrl
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
	const media = res.data.data.Media;
	return {
		thumbnail_url: media.coverImage.large,
		anilist_url: media.siteUrl,
	};
};

function proposal_from_anilist_media(msg, media) {
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
}
module.exports.proposal_from_anilist_media = proposal_from_anilist_media;

module.exports.proposal_from_url = async function (url, msg) {
	const anilist_prefix = 'anilist.co/anime/';
	const anilist_suffix = '/';
	if (url.includes(anilist_prefix)) {
		const prefix_end_idx = url.indexOf(anilist_prefix) + anilist_prefix.length;
		let anilist_id = url.substring(
			prefix_end_idx,
			url.indexOf(anilist_suffix, prefix_end_idx)
		);

		const anilist_media = await get_anilist_media_by_id(anilist_id);
		return anilist_media != null
			? proposal_from_anilist_media(msg, anilist_media)
			: null;
	}

	const mal_prefix = 'myanimelist.net/anime/';
	const mal_suffix = '/';
	if (url.includes(mal_prefix)) {
		const prefix_end_idx = url.indexOf(mal_prefix) + mal_prefix.length;
		let mal_id = url.substring(
			prefix_end_idx,
			url.indexOf(mal_suffix, prefix_end_idx)
		);

		const mal_media = await get_anilist_media_by_mal_id(mal_id);
		return mal_media != null
			? proposal_from_anilist_media(msg, mal_media)
			: null;
	}

	return null;
};
