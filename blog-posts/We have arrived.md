#title we have arrived
#date 2025-02-11

welp it took me two days but I propped up this site. I knew nothing about github pages and all the hoops involved, but hey we're here. Let me recap for those who may decide to set up a static website in the most back asswards way possible:
- create a repo in github named username.github.io - this will be your site (just like mine!)
- enable github pages in the settings and set it to the main branch (if you toggle between main/docs/none/whatever you'll be able to save changes. fun feature.)
- add some pages to the repo root. this will be the funnest part of the process.
- commit and push that shiz and if you're lucky it'll be up and running
so yeah this will make a boring ole site with baby's first website vibes, but I wanted to make a blog to post my rambling. For this, we look to... github actions.
again, never messed with them but only knew they existed in some capacity. Turns out to be really powerful and rage inducing. Lets dive in
- actions uses a yml file to give a whole bunch instructions to github that can automate things. neat!
- I needed this to generate the json (and eventually the html) behind each blog post because github pages is static so there's no backend out of the box
- sooooo you gotta create a authentication token (the classic one not the new one... for reasons), then add that token into the yml and after several fights with chatGPT (who will now be referred to as Jeeves) we have a json file that is generated with builds the html pages which is committed through the actions. yeah.
"but how do you generate the json?" I hear you ask. We use markdown! New to me, markdown is like html but slightly dumber but can be just as effective, like slingblade.
The easiest way to generate markdown that the actions will convert into json is through Obsidian. Its a fancy note taking app but outputs in markdown. It also has a robust tag feature that we can use to parse the pieces needed for the json to be created. 
Seems kinda easy/silly/boring/whoareyoutalking to, but hey we're here now and let's hope I keep talking to myself for a while.