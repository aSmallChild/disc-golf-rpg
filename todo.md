I am thinking of making a web based game. Disc golf. RPG. You don't have direct control over the throw. But you dictate what you want the character to do.
Excalibur looks like a good candidat, but I need to represent terrain and height of obsticals. So think of options, and lets make a plan.

I am planning on hosting this on my website using cloudflare as my platform.

Top down view. The game revolves around a skill tree. I would like it to play like fallout 2, where you can aim at a target (althoug the target would be a fairway or basket) but I like the idea of the aimed shots where you can select where on the basket or where
  on the fairway that you are aiming. And part of that selection would include the type of shot you're doing e.g. spike hyzer which has a chance of getting over tall obsticals and also tombstoning so it doesn't roll down a slope.
  The game isn't completely serious. The skills revolve heavily around gear. Each piece of gear (chalk bag and telescopic disc retrival stick) boosts chances to succeed at various things in the game.

For example (and this section needs to become documented for later implementation and I would like a folder with ideas in different md files that I will review and organise with you later) Individual ideas go into files, then later we'll tag and categorize them to 
find a path for progression through skills (skills that unlock other skills in the tree)

chalk bag, useful for windreads and grip, also helps manage anger by clapping the bag after a bad putt. 
Small increase to grip lock chance. Boosts spin which improves range(suggest improvements and benefits) the higher a skill the less likely the negative impacts are and the more significant the benefits are.

Telescopic disc retrival stick: improves chances of retrieving a disc. If you don't successfully retrieve a disc you lose it. If you have no discs and no money to buy discs it is game over. This is a significant skill
and is not something that players may necessarily think to invest skill points in.

The game will have tournaments, it would be good to have multiplayer.

I like the fallout style of character stats (strength dexterity intelligence etc.. but might need a think of more disc golf appropriate one), and this is coupled with skills but this will differ from fallout because I want skills to tie to a tree. Some skills improve chances, other skills unlock abilities.
most important is luck
luck is in fact so important that it is not just a character attribute, but a skill as well. Luck as a skill that allows for a more concentrated application of luck for a desired outcome that can even accomplish things that would otherwise be locked. (e.g. flukes)

When a skill is used the game needs to report feedback to the user as to why it succeeded or failed. There should of course be influence from the conditions wind rain snow, and the type of ground changes how the disc reacts, water, rocky, dry grass, tall grass, ice

I want help managing all this information and requirements. Make a folder or use the defined patterns you already have for managing AI instructions, these need to stick across sessions.
Rules (confirm with me before modifying this but you can make a dir with coding instructions and inform me the best way to split this up):
Minimal text output while thinking outloud to save tokens
