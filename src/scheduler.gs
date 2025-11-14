/** ========= scheduler.gs ========= */
// A=投稿日, B=スロット, C=本文, D=投稿済, E=結果, F=画像, G=インサイト取得予定時刻, H=インサイト結果
// 当日(JST) かつ スロットの時刻 <= 現在(JST) で投稿。成功で D=TRUE, E=OK: <threadId>、失敗で E=ERR を設定
function runScheduler() {
  withLock_(() => {
    const now = new Date(Utilities.formatDate(new Date(), JPN_TZ, 'yyyy/MM/dd HH:mm:ss'));
    const values = readRows_();
    if (!values.length) return;

    let touched = false;
    const todayJst = Utilities.formatDate(now, JPN_TZ, 'yyyy/MM/dd');

    for (let i = 0; i < values.length; i++) {
      const [postDate, slot, text, posted, , images] = values[i];
      if (!postDate || !slot || !text || posted === true) continue;

      // 当日（JST）のみ対象
      const postDateStr = Utilities.formatDate(new Date(postDate), JPN_TZ, 'yyyy/MM/dd');
      if (postDateStr !== todayJst) continue;

      // スロットを時刻へマッピング
      const key = String(slot).trim().toLowerCase();
      const timeStr = SLOT_TO_TIME[key];
      if (!timeStr) {
        values[i][4] = `ERR: unknown slot "${slot}"`;
        touched = true;
        continue;
      }

      // 当日のスロット時刻をJSTで作成
      const target = new Date(Utilities.formatDate(new Date(`${postDateStr} ${timeStr}`), JPN_TZ, 'yyyy/MM/dd HH:mm:ss'));

      if (target <= now) {
        // 画像ソースの解析（最大10枚）
        const sources = images
          ? String(images).split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, 10)
          : [];
        const mediaIds = resolveMediaIdsFromSources_(sources);
        try {
          const r = postThread_(text, mediaIds);
          values[i][3] = true; // D=TRUE
          values[i][4] = `OK: ${r?.data?.id || r?.id || ''}`; // E=結果
          // インサイト取得予定時刻をG列に記録（投稿時刻 + 待機時間）
          const delayHours = getInsightDelayHours_();
          const insightTime = new Date(target.getTime() + delayHours * 60 * 60 * 1000);
          values[i][6] = Utilities.formatDate(insightTime, JPN_TZ, 'yyyy/MM/dd HH:mm:ss'); // G=インサイト取得予定時刻
          Logger.log(`OK ${r?.data?.id || r?.id || ''} : ${text} (insight at ${values[i][6]})`);
        } catch (e) {
          values[i][4] = `ERR: ${e.message}`;
          Logger.log(`ERR ${e.message}`);
        }
        // 速すぎる連投を避ける
        Utilities.sleep(1500);
        touched = true;
      }
    }

    if (touched) writeRows_(values);
  });
}

// 手動テスト（今すぐ1件だけ投げたい時など）
function testThreadOnce() {
  const r = postThread_('テスト投稿：シート運用版の動作確認 ✅');
  Logger.log(r);
}

// インサイト自動集計（G列の時刻が過ぎた行のインサイトを取得してH列に記録）
function collectInsights() {
  withLock_(() => {
    const now = new Date(Utilities.formatDate(new Date(), JPN_TZ, 'yyyy/MM/dd HH:mm:ss'));
    const values = readRows_();
    if (!values.length) return;

    let touched = false;

    for (let i = 0; i < values.length; i++) {
      const [postDate, slot, text, posted, result, , insightTime, insightResult] = values[i];
      // 投稿済み、結果にThread IDあり、インサイト取得予定時刻あり、まだ取得していない行のみ対象
      if (!posted || !result || !insightTime || insightResult) continue;
      
      const resultMatch = String(result).match(/^OK:\s*(\S+)$/);
      if (!resultMatch) continue; // Thread IDが取得できない場合はスキップ
      const threadId = resultMatch[1];

      // インサイト取得予定時刻が過ぎているか確認
      const targetTime = new Date(Utilities.formatDate(new Date(insightTime), JPN_TZ, 'yyyy/MM/dd HH:mm:ss'));
      if (targetTime > now) continue; // まだ時刻が来ていない

      try {
        const metrics = getThreadInsights_(threadId);
        if (metrics) {
          // 見やすい形式で記録: エンゲージメント/インプレッション/リーチ
          const insightStr = `👍${metrics.engagement || 0} 👁️${metrics.impressions || 0} 📊${metrics.reach || 0}`;
          values[i][7] = insightStr; // H=インサイト結果
          Logger.log(`INSIGHT ${threadId}: ${insightStr}`);
        } else {
          values[i][7] = 'ERR: metrics not found';
        }
      } catch (e) {
        values[i][7] = `ERR: ${e.message}`;
        Logger.log(`INSIGHT ERR ${threadId}: ${e.message}`);
      }
      Utilities.sleep(1000); // API制限対策
      touched = true;
    }

    if (touched) writeRows_(values);
  });
}

