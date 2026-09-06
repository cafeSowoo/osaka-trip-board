/* Production-mode smoke test. Requires OSAKA_INVITE_TOKEN; test row is deleted before exit. */
const {chromium}=require('../.qa/node_modules/playwright');
const assert=require('node:assert/strict');
const token=process.env.OSAKA_INVITE_TOKEN;
const token2=process.env.OSAKA_INVITE_TOKEN_P2;
if(!token)throw new Error('OSAKA_INVITE_TOKEN is required');
const BASE=process.env.TRIP_REMOTE_TEST_URL||'http://osaka.test:8914/';

(async()=>{
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless:true,
    args:['--host-resolver-rules=MAP osaka.test 127.0.0.1','--no-proxy-server']
  });
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.setDefaultTimeout(12000);
  try{
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('.join-card').waitFor();
    await page.locator('#join-token').fill(token);
    await page.locator('.join-form button[type="submit"]').click();
    await page.locator('.slot').first().waitFor();
    assert.equal(await page.locator('.profile-name').innerText(),'지석');
    assert.equal(await page.locator('.slot').count(),8);

    await page.locator('.bottom-nav .nav-add').click();
    await page.locator('#candidate-title').fill('REMOTE_QA_DELETE_ME');
    await page.locator('[data-action="generate-link"]').click();
    await page.locator('#candidate-form button[type="submit"]').click();
    await page.locator('#panel-dialog').waitFor({state:'hidden'});
    await page.waitForTimeout(1200);
    if(token2){
      const context2=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul'});
      const page2=await context2.newPage();
      await page2.goto(BASE,{waitUntil:'domcontentloaded'});
      await page2.locator('#join-token').fill(token2);
      await page2.locator('.join-form button[type="submit"]').click();
      await page2.locator('.slot').first().waitFor();
      assert.equal(await page2.locator('.profile-name').innerText(),'여행자 2');
      await page2.locator('[data-action="participants"]:visible').first().click();
      assert.equal(await page2.locator('#panel-dialog [data-action="select-person"]').count(),0);
      await page2.locator('#panel-dialog [data-action="close-modal"]').click();
      await page2.locator('.bottom-nav [data-view="candidates"]').click();
      await page2.locator('[data-action="detail"]:visible',{hasText:'REMOTE_QA_DELETE_ME'}).first().waitFor({timeout:8000});
      await page2.locator('[data-action="vote"]:visible').first().click();
      await page2.waitForTimeout(1100);
      await context2.close();
      await page.waitForTimeout(5500);
    }
    await page.getByText('REMOTE_QA_DELETE_ME',{exact:true}).first().click();
    await page.locator('#panel-dialog [data-action="vote"]').click();
    await page.waitForTimeout(900);
    await page.locator('#comment-text').fill('remote qa');
    await page.locator('.comment-form button[type="submit"]').click();
    await page.waitForTimeout(900);
    await page.locator('#panel-dialog [data-action="delete"]').click();
    await page.locator('#confirm-dialog [data-action="accept-confirm"]').click();
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('[data-action="detail"]:visible',{hasText:'REMOTE_QA_DELETE_ME'}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS remote invite, shared load, candidate write, vote, comment and cleanup');
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
