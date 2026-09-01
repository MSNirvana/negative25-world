<script setup lang="ts">
import { useLocale } from '../i18n';

const { t } = useLocale();
</script>

<template>
  <main class="about-page page-frame">
    <header class="about-hero">
      <h1>
        <span class="title-zh">{{ t('about.titleZh') }}</span>
        <span class="title-en">{{ t('about.titleEn') }}</span>
      </h1>
      <p class="about-subtitle">
        <span>{{ t('about.subtitleZh') }}</span>
        <span>{{ t('about.subtitleEn') }}</span>
      </p>
    </header>

    <article class="essay">
      <p>我曾读过一本书，叫做《每周工作4小时》，书中写着：</p>
      <ol>
        <li>我必须是二十几岁的单身一族吗？</li>
        <li>我必须辞职吗？我必须承担风险吗？</li>
        <li>我必须要旅行吗？我只想拥有更多的时间而已。</li>
        <li>我必须出生于富裕家庭吗？</li>
        <li>我必须毕业于名牌大学吗？</li>
      </ol>

      <p>作者的回答都是“不一定”，我十分认可，随即，我立马跟我老婆说了这件事和这个观点，她也表示认可。我俩的人生观大多数一直保持一致，就是及时享乐，我们可以在一个周末的清晨突然刷到瀑布，然后半个小时内就收拾出门，驱车前往。我们也可以在临近睡觉的时候突然看到一部电影而立马买票出门。这种方式在我的生活中很多时候习以为常，这并不会破坏什么，不会影响明天的生活、工作、情感等，但能即刻满足内心的需求。我喜欢这种感觉。</p>

      <p>此时，我站在即将而立之年，思考了一下人生，得到一个想法，就是：在富余的体能下人生剩30年，你想怎么过？我觉得跟这本书想表达的观点有一些同步，人不是生下来就为了工作，劳动，过着两点一线的生活。</p>

      <p>书中表示：描述你所担心的噩梦，如果现在就做你想做的事，最坏的后果可能是什么。一想到你能够——必须——做出的巨大改变时，脑海中立即显现的是哪些疑虑、恐惧和“推测”（what-ifs）？尽可能详尽地把它们描述出来。改变会是你人生的终结吗？你认为这些后果发生的几率有多大？</p>

      <p>在之前跟朋友交流的时候也做过一些思考：</p>
      <h2>出去玩就要趁年轻！</h2>
      <p>和朋友聊到去过哪些国家，聊到一个观点：就是一定要趁年轻出去玩，<strong>因为越早体验对人生的复利越高。</strong></p>

      <p>但很多人又会拿一个观点来反驳，就是没钱没时间。</p>

      <p>我认为没错，这是很现实的问题，但我想这不是正确的生活态度，这是一个不同人对三观观念的体现：</p>

      <p>我倡导至少从大学开始，就要玩遍大学所在省+周边省份。这至少5个省，同学之间组团也好，个人计划也好，一般都是在外省上大学，那是你第一次真正意义的出远门。</p>

      <p>对于20-30岁的十年，没有人会挑你过的怎么样，是否有房有车有存款，哪怕你今天因为去追逐日出，看花开花落，睡在公园、网吧、洗浴中心等等，我只会觉得你牛比，没有人会嫌弃，也不会说你什么。</p>

      <blockquote>青春没有售价，硬座直达拉萨；没有人能同时拥有青春和对青春的理解。</blockquote>

      <p>对于这两句话一种是执行、一种是感悟，我深有体会，我大学曾一张硬座直达内蒙，去感受那辽阔草原，去体验望山跑死马，去突破一天步数5w的个人极限……</p>

      <p>我十分感谢生在当代中国，因为这里有960万平方公里的土地，这里有和平环境，这里有世界最强大的基建。这960万有的人一辈子都走不完，有的人甚至走不出那个零头，但也是个人选择，并不作为人生标准。</p>

      <p>我算过一笔账，就拿10万来说，中国有34个省级行政区，平均分配大概是3000/省，我觉得够了，觉得不够的可以问问AI，它会告诉你，不仅行得通，而且还有一定余量。那我们又如何获得这10万呢？其实很简单，这10万并不是一次性拿出来，而是逐年分在20-30岁（也可以是17-27），你的压岁钱也好，你日常做一些勤工俭学也好，你跟父母商量也好，哪怕你去银行贷款！只要你想，那肯定是能合理的获取到！</p>

      <p>10万对于20岁的年轻人来讲，这很多，但对于30岁之后的你来讲，那并不是很重要。重要的是这些经历带给你未来超过50年的复利，每当你和其他人沟通、工作、交际等，这些经历会源源不断的加入你的思考，你的判断中，进而塑造你的三观，这将是你最成功的一笔投资。</p>

      <p>回望我这即将30岁的人生，讲的直白点，人生也过去了一半（60岁之后难以有所疯狂），有时候在想，上班真的有那么重要吗？你是一个碳基生命诶，你有一天你TM会死诶，你是一个独立个体，在这个地球Online游戏，你到底想怎么活？</p>

      <div class="essay-questions" aria-label="人生问题">
        <p>你见过日照金山吗？</p>
        <p>你在5000米海拔上蹦过迪吗？</p>
        <p>你在一望无际的草原上奔跑过吗？</p>
        <p>你见过海上生明月吗？</p>
        <p>你在沙漠里等过日出吗？</p>
        <p>你在雪山脚下数过星星吗？</p>
        <p>你为了一个风景，坐过二十多个小时的硬座吗？</p>
        <p>你有没有在某个瞬间，突然觉得——活着，真好？</p>
      </div>

      <p>你究其几十年，生活的三点一线，哦不，那是生存的三点一线。</p>

      <p>人不可能脱离群体，你会有亲情、爱情、友情，这些有时候也是枷锁，也会是人生意义，这些我们都不谈，我只谈你别虚度人生，真正值得珍藏的，不是目的地，而是那些塑造了你的经历。</p>

      <p>回归正传，用你喜欢的方式过一生。</p>

      <p class="essay-ps">PS：未来深度AI时代，大多数人都没有工作意义，你得找到你人生意义。</p>
    </article>

  </main>
</template>

<style scoped>
.about-page { padding-bottom: 70px; }
.about-hero { margin: 0 auto; max-width: 680px; padding: 68px 0 31px; text-align: left; }
.about-hero h1 { margin: 15px 0 0; }
.title-zh, .title-en { display: block; font-family: Georgia, ui-serif, serif; font-weight: 500; letter-spacing: -.045em; }
.title-zh { font-size: clamp(30px, 7vw, 74px); line-height: 1.04; white-space: nowrap; }
.title-en { color: var(--muted); font-size: clamp(21px, 3vw, 34px); letter-spacing: -.025em; line-height: 1.18; margin-top: 14px; }
.about-subtitle { color: var(--muted); display: flex; flex-wrap: wrap; font-size: 14px; gap: 7px 18px; justify-content: flex-start; line-height: 1.5; margin: 24px 0 0; }
.about-subtitle span + span { font-family: Georgia, ui-serif, serif; font-size: 13px; }
.essay { margin: 32px auto 0; max-width: 680px; }
.essay p, .essay li { color: var(--ink); font-size: 16px; line-height: 1.95; }
.essay p { margin: 0 0 24px; }
.essay ol { margin: -4px 0 28px; padding-left: 1.65em; }
.essay li { padding-left: 5px; }
.essay h2 { font-family: Georgia, ui-serif, serif; font-size: clamp(28px, 4vw, 38px); font-weight: 500; letter-spacing: -.03em; line-height: 1.2; margin: 48px 0 22px; }
.essay strong { font-weight: 700; }
.essay blockquote { border-left: 2px solid var(--accent); color: var(--accent-deep); font-family: Georgia, ui-serif, serif; font-size: 20px; line-height: 1.7; margin: 36px 0; padding: 4px 0 4px 22px; }
.essay-questions { border-bottom: 1px solid var(--line); border-top: 1px solid var(--line); margin: 40px 0; padding: 22px 0 19px; }
.essay-questions p { font-family: Georgia, ui-serif, serif; font-size: 21px; line-height: 1.55; margin: 0 0 7px; }
.essay-questions p:last-child { margin-bottom: 0; }
.essay-ps { border-top: 1px solid var(--line); color: var(--muted) !important; font-size: 13px !important; margin-top: 46px !important; padding-top: 22px; }
@media (max-width: 640px) {
  .about-page { padding-bottom: 42px; }
  .about-hero { padding: 42px 0 19px; }
  .title-zh { font-size: clamp(30px, 11vw, 58px); }
  .title-en { font-size: clamp(19px, 6vw, 27px); margin-top: 10px; }
  .about-subtitle { display: grid; gap: 3px; justify-content: initial; margin-top: 18px; }
  .essay { margin-top: 21px; }
  .essay p, .essay li { font-size: 15px; line-height: 1.9; }
  .essay h2 { margin-top: 40px; }
  .essay blockquote { font-size: 18px; margin: 30px 0; padding-left: 17px; }
  .essay-questions p { font-size: 19px; }
}
</style>
