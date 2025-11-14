/** ========= oauth1.gs ========= */
// OAuth1.0a ヘッダー生成（HMAC-SHA1, BodyはJSON）
function buildOAuthHeader_(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  };

  // URLからクエリパラメータを抽出（GETリクエスト用）
  const urlObj = url.split('?');
  const baseUrl = urlObj[0];
  const queryParams = {};
  if (urlObj.length > 1) {
    urlObj[1].split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }

  // OAuthパラメータとクエリパラメータをマージして署名ベース文字列を作成
  const allParams = { ...oauthParams, ...queryParams };
  const baseParams = Object.keys(allParams).sort()
    .map(k => `${enc(k)}=${enc(allParams[k])}`).join('&');

  const baseString = [method.toUpperCase(), enc(baseUrl), enc(baseParams)].join('&');
  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;

  const rawSig = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    baseString,
    signingKey
  );
  const signature = Utilities.base64Encode(rawSig);

  // Authorization ヘッダー
  const header = 'OAuth ' + Object.keys(oauthParams).concat(['oauth_signature'])
    .map(k => {
      const v = (k === 'oauth_signature') ? signature : oauthParams[k];
      return `${enc(k)}="${enc(v)}"`;
    }).join(', ');

  return header;
}

