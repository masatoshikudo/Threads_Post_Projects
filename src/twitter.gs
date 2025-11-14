/** ========= twitter.gs ========= */
function postTweet_(text, mediaIds) {
  if (!text) throw new Error('text is empty');
  const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = getAuthProps_();

  const authHeader = buildOAuthHeader_('POST', TWEET_ENDPOINT,
    CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET);

  const payload = mediaIds && mediaIds.length
    ? { text, media: { media_ids: mediaIds.slice(0, 4) } }
    : { text };

  const res = UrlFetchApp.fetch(TWEET_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: authHeader },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) return JSON.parse(body);
  throw new Error(`POST失敗 code=${code} body=${body}`);
}

// 画像Blobを v1.1 media/upload でアップロードし media_id_string を返す
function uploadImageAndGetMediaId_(blob) {
  if (!blob) throw new Error('blob is empty');
  const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = getAuthProps_();
  const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
  const authHeader = buildOAuthHeader_('POST', UPLOAD_URL,
    CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET);

  const res = UrlFetchApp.fetch(UPLOAD_URL, {
    method: 'post',
    headers: { Authorization: authHeader },
    payload: { media: blob }, // multipart/form-data を自動構築
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) {
    const json = JSON.parse(body);
    if (!json.media_id_string) throw new Error('media_id_string missing');
    return json.media_id_string;
  }
  throw new Error(`MEDIA_UPLOAD失敗 code=${code} body=${body}`);
}

// 画像ソース（URL または drive:<fileId>）配列から media_ids を作成
function resolveMediaIdsFromSources_(sources) {
  if (!sources || !sources.length) return [];
  const ids = [];
  for (let i = 0; i < sources.length && ids.length < 4; i++) {
    const src = String(sources[i]).trim();
    if (!src) continue;
    let blob;
    try {
      if (src.toLowerCase().startsWith('drive:')) {
        const fileId = src.split(':')[1];
        blob = DriveApp.getFileById(fileId).getBlob();
      } else {
        const res = UrlFetchApp.fetch(src, { muteHttpExceptions: true });
        const code = res.getResponseCode();
        if (code < 200 || code >= 300) throw new Error(`fetch ${code}`);
        blob = res.getBlob();
      }
      const mid = uploadImageAndGetMediaId_(blob);
      ids.push(mid);
      Utilities.sleep(500); // 連続アップロードの間隔
    } catch (e) {
      Logger.log(`MEDIA ERR for "${src}": ${e.message}`);
    }
  }
  return ids;
}

// ツイートIDからインサイト（エンゲージメント数）を取得
function getTweetInsights_(tweetId) {
  if (!tweetId) throw new Error('tweetId is empty');
  const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = getAuthProps_();
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
  const authHeader = buildOAuthHeader_('GET', url,
    CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET);

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: authHeader },
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) {
    const json = JSON.parse(body);
    return json.data?.public_metrics || null;
  }
  throw new Error(`GET_INSIGHTS失敗 code=${code} body=${body}`);
}

