import { getConfig } from '../../data/config.js';
import { generateJWT } from '../../core/auth.js';

const APP_ID = 'wx31089b7fb811b8c2';
const APP_SECRET = '你的AppSecret';

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
