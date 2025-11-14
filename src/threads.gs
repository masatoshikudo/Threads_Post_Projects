/** ========= threads.gs ========= */
// Threadsに投稿
function postThread_(text, mediaIds) {
  if (!text) throw new Error('text is empty');
  const { ACCESS_TOKEN, USER_ID } = getAuthProps_();

  // Threads投稿エンドポイント
  const endpoint = `${THREADS_ENDPOINT_BASE}/${USER_ID}/threads`;
  
  // パラメータを構築
  const params = {
    text: text,
    access_token: ACCESS_TOKEN
  };

  // メディアがある場合はchildrenを追加（カンマ区切り）
  if (mediaIds && mediaIds.length > 0) {
    params.children = mediaIds.slice(0, 10).join(','); // Threadsは最大10枚まで
  }

  // URLパラメータとして送信
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const url = `${endpoint}?${queryString}`;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) {
    const json = JSON.parse(body);
    return json;
  }
  throw new Error(`POST失敗 code=${code} body=${body}`);
}

// 画像BlobをInstagram Graph APIでアップロードし media_id を返す
// 注意: Instagram Graph APIは公開URLを要求するため、この関数は使用しません
// resolveMediaIdsFromSources_で直接URLからメディアIDを取得します
function uploadImageAndGetMediaId_(blob) {
  throw new Error('Threads APIでは、画像は公開URLから直接アップロードしてください');
}

// 画像ソース（URL）配列から media_ids を作成
// Threads APIは公開URLを要求するため、URLを直接使用
function resolveMediaIdsFromSources_(sources) {
  if (!sources || !sources.length) return [];
  const { ACCESS_TOKEN, USER_ID } = getAuthProps_();
  const ids = [];
  
  for (let i = 0; i < sources.length && ids.length < 10; i++) {
    const src = String(sources[i]).trim();
    if (!src) continue;
    
    try {
      let imageUrl = src;
      
      // DriveファイルIDの場合は公開URLを取得
      if (src.toLowerCase().startsWith('drive:')) {
        const fileId = src.split(':')[1];
        const file = DriveApp.getFileById(fileId);
        // Driveファイルを公開URLとして取得
        // 注意: ファイルを「リンクを知っている全員」に共有する必要があります
        // 共有リンクを取得（WebViewLinkを使用）
        try {
          // ファイルの共有URLを取得
          imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
          // または、ファイルが公開されている場合は直接URLを使用
          // imageUrl = file.getUrl().replace('/edit', '/view');
        } catch (e) {
          Logger.log(`Drive URL取得失敗 "${src}": ${e.message}`);
          continue;
        }
      }
      
      // Instagram Graph APIでメディアコンテナを作成
      // ステップ1: メディアコンテナを作成
      const mediaUrl = `https://graph.instagram.com/${USER_ID}/media`;
      const createParams = {
        image_url: imageUrl,
        access_token: ACCESS_TOKEN
      };
      
      const createQueryString = Object.keys(createParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(createParams[key])}`)
        .join('&');
      
      const createUrl = `${mediaUrl}?${createQueryString}`;
      
      const createRes = UrlFetchApp.fetch(createUrl, {
        method: 'post',
        muteHttpExceptions: true,
      });
      
      const createCode = createRes.getResponseCode();
      const createBody = createRes.getContentText();
      
      if (createCode >= 200 && createCode < 300) {
        const createJson = JSON.parse(createBody);
        if (createJson.id) {
          // ステップ2: メディアコンテナを公開（publish）
          const publishUrl = `https://graph.instagram.com/${USER_ID}/media_publish`;
          const publishParams = {
            creation_id: createJson.id,
            access_token: ACCESS_TOKEN
          };
          
          const publishQueryString = Object.keys(publishParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(publishParams[key])}`)
            .join('&');
          
          const publishUrlWithParams = `${publishUrl}?${publishQueryString}`;
          
          const publishRes = UrlFetchApp.fetch(publishUrlWithParams, {
            method: 'post',
            muteHttpExceptions: true,
          });
          
          const publishCode = publishRes.getResponseCode();
          const publishBody = publishRes.getContentText();
          
          if (publishCode >= 200 && publishCode < 300) {
            const publishJson = JSON.parse(publishBody);
            // 公開されたメディアIDを使用（creation_idではなく、公開後のID）
            // ただし、Threads APIではcreation_idをそのまま使用する場合もあります
            ids.push(createJson.id); // または publishJson.id
            Logger.log(`メディアID取得成功: ${createJson.id} for "${src}"`);
          } else {
            Logger.log(`メディア公開失敗 "${src}": code=${publishCode} body=${publishBody}`);
            // 公開に失敗してもcreation_idは使用可能な場合がある
            ids.push(createJson.id);
          }
        } else {
          Logger.log(`メディアID取得失敗 "${src}": id not found in response`);
        }
      } else {
        Logger.log(`メディアアップロード失敗 "${src}": code=${createCode} body=${createBody}`);
      }
      
      Utilities.sleep(1000); // API制限対策
    } catch (e) {
      Logger.log(`MEDIA ERR for "${src}": ${e.message}`);
    }
  }
  
  return ids;
}

// Thread IDからインサイト（エンゲージメント数）を取得
function getThreadInsights_(threadId) {
  if (!threadId) throw new Error('threadId is empty');
  const { ACCESS_TOKEN } = getAuthProps_();
  
  // Instagram Graph APIのインサイトエンドポイント
  const url = `https://graph.instagram.com/${threadId}/insights?metric=engagement,impressions,reach&access_token=${ACCESS_TOKEN}`;

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 200 && code < 300) {
    const json = JSON.parse(body);
    // インサイトデータを整形
    if (json.data) {
      const metrics = {};
      json.data.forEach(item => {
        metrics[item.name] = item.values[0]?.value || 0;
      });
      return {
        engagement: metrics.engagement || 0,
        impressions: metrics.impressions || 0,
        reach: metrics.reach || 0,
      };
    }
    return null;
  }
  throw new Error(`GET_INSIGHTS失敗 code=${code} body=${body}`);
}

