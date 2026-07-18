const APP_ID = 'wx31089b7fb811b8c2';
const APP_SECRET = '5af6386061903ab60fe558090c9af819';
const TEMPLATE_ID = 'TBzI9fIquS62yigOcJeprGCM7m8QfQOXBQtqqTN2g30';

async function getAccessToken() {
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`
  );
  const data = await res.json();
  return data.access_token || null;
}

export async function sendWxNotifyToAll(env, subscriptions) {
  try {
    const indexRaw = await env.SUBSCRIPTIONS_KV.get('wx_openid_index');
    if (!indexRaw) {
      console.log('[微信推送] 没有已订阅用户');
      return;
    }
    const openids = JSON.parse(indexRaw);
    if (!openids.length) return;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[微信推送] 获取access_token失败');
      return;
    }

    for (const sub of subscriptions) {
      const dueDate = new Date(sub.expiryDate);
      const diffDays = Math.round((dueDate - new Date()) / 86400000);
      const dueDateStr = `${dueDate.getFullYear()}年${dueDate.getMonth()+1}月${dueDate.getDate()}日`;

      for (const openid of openids) {
        const res = await fetch(
          `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              touser: openid,
              template_id: TEMPLATE_ID,
              data: {
                thing1: { value: sub.name.slice(0, 20) },
                time2: { value: dueDateStr },
                amount3: { value: sub.amount ? `${sub.amount}${sub.currency || 'CNY'}` : '未设置' },
                thing4: { value: `还有${diffDays}天到期，请及时续费` }
              }
            })
          }
        );
        const data = await res.json();
        if (data.errcode === 0) {
          console.log(`[微信推送] 成功: ${sub.name} -> ${openid}`);
        } else {
          console.error(`[微信推送] 失败:`, data);
        }
      }
    }
  } catch (error) {
    console.error('[微信推送] 异常:', error);
  }
}
