import { getConfig } from '../../data/config.js';
import { generateJWT } from '../../core/auth.js';

const APP_ID = 'wx31089b7fb811b8c2';
const APP_SECRET = '5af6386061903ab60fe558090c9af819';
const TEMPLATE_ID = 'TBzI9fIquS62yigOcJeprGCM7m8QfQOXBQtqqTN2g30';

export async function handleWxLogin(request, env) {
  try {
    const body = await request.json();
    const code = body.code;
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少code参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 用code换取openid
    const wxRes = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`
    );
    const wxData = await wxRes.json();

    if (wxData.errcode) {
      return new Response(
        JSON.stringify({ success: false, message: '微信登录失败: ' + wxData.errmsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openid = wxData.openid;

    // 保存 openid 到 KV
    await env.SUBSCRIPTIONS_KV.put(`wx_openid:${openid}`, JSON.stringify({
      openid,
      subscribedAt: new Date().toISOString()
    }));

    // 保存所有 openid 的索引
    const indexRaw = await env.SUBSCRIPTIONS_KV.get('wx_openid_index');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    if (!index.includes(openid)) {
      index.push(openid);
      await env.SUBSCRIPTIONS_KV.put('wx_openid_index', JSON.stringify(index));
    }

    const config = await getConfig(env);
    const token = await generateJWT(openid, config.JWT_SECRET);

    return new Response(
      JSON.stringify({ success: true, token }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 发送微信订阅消息
export async function sendWxSubscribeMessage(openid, subscription) {
  try {
    // 获取 access_token
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[微信推送] 获取access_token失败:', tokenData);
      return false;
    }

    const accessToken = tokenData.access_token;
    const dueDate = new Date(subscription.expiryDate);
    const dueDateStr = `${dueDate.getFullYear()}年${dueDate.getMonth()+1}月${dueDate.getDate()}日`;
    const diffDays = Math.round((dueDate - new Date()) / 86400000);

    // 发送订阅消息
    const msgRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: openid,
          template_id: TEMPLATE_ID,
          data: {
            thing1: { value: subscription.name.slice(0, 20) },
            time2: { value: dueDateStr },
            amount3: { value: subscription.amount ? `${subscription.amount}${subscription.currency || 'CNY'}` : '未设置' },
            thing4: { value: `还有${diffDays}天到期，请及时续费` }
          }
        })
      }
    );

    const msgData = await msgRes.json();
    if (msgData.errcode === 0) {
      console.log(`[微信推送] 发送成功: ${subscription.name} -> ${openid}`);
      return true;
    } else {
      console.error(`[微信推送] 发送失败:`, msgData);
      return false;
    }
  } catch (error) {
    console.error('[微信推送] 异常:', error);
    return false;
  }
}
