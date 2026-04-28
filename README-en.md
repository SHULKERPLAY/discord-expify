![Yuko <3](https://github.com/SHULKERPLAY/discord-expify/blob/prod/expify.webp)

*Unavailable in Discord Application Discovery for now. You can [click here to try installation on your server](https://discord.com/oauth2/authorize?client_id=848867725866172426)*

# EXPIFY
A Discord bot for servers featuring an enhanced leveling system for Text, Voice, and Video. It supports toggling experience types, adjusting XP gain rates, reward roles, ignoring specific channels/users/roles, and much more, with a focus on the most honest competition for server activity.

- [EXPIFY](#expify)
- [Experience System](#experience-system)
    - [Basic Rules](#basic-rules)
    - [Text Experience](#text-experience)
    - [Voice Experience](#voice-experience)
    - [Video Experience](#video-experience)
- [Rewards and Modes](#rewards-and-modes)
    - [Reward Modes](#reward-modes)
- [Access Levels](#access-levels)
- [Migration](#migration)
  - [Help Section](#help-section)
- [Restricting the `/rank` Command to a Specific Channel](#restricting-the-rank-command-to-a-specific-channel)
- [Localization](#localization)
- [Viewing Your Level](#viewing-your-level)
- [Managing Experience Points on the Server](#managing-experience-points-on-the-server)
  - [Resetting Experience for All Members](#resetting-experience-for-all-members)
  - [Disabling Any Type of Experience](#disabling-any-type-of-experience)
  - [Blacklisting Users/Roles/Channels from Gaining XP](#blacklisting-usersroleschannels-from-gaining-xp)
  - [Setting Custom Base XP Per Minute](#setting-custom-base-xp-per-minute)
- [Managing Server Rewards](#managing-server-rewards)
  - [Adding a Reward](#adding-a-reward)
  - [Updating a Reward](#updating-a-reward)
  - [Removing a Reward](#removing-a-reward)
  - [Viewing the Reward List](#viewing-the-reward-list)
  - [Revoking Rewards from Members Who Don't Meet Requirements](#revoking-rewards-from-members-who-dont-meet-requirements)
- [Displaying the Server Leaderboard](#displaying-the-server-leaderboard)
- [Viewing Server Settings](#viewing-server-settings)
- [Configuring Channels for Bot Notifications](#configuring-channels-for-bot-notifications)
- [Other](#other)

# Experience System

I have tried to create the most honest experience system based on observations over six years of moderating [our Discord server](https://discord.gg/e2HcXrQ).

### Basic Rules

- Maximum experience points supported: `160,280,000` XP (160 million).
  - This corresponds to a maximum level of: `1,000`.
  - If this seems small: at the minimum base value of `5`, you would need to stay in voice chat for ~61 years non-stop to reach max level. At the standard `10`: ~30.5 years, and at the maximum `100`: ~3 years.
- Experience is awarded once per minute based on all conditions set in the system.
- Reward distribution occurs every 5 minutes for all users active in the last few minutes. Once complete, if an announcement channel is set, an embedded message will be sent listing the users and their new rewards. The message is an embed, so it won't ping users or roles.
- Experience for each level has a base value managed by the administrator via the `/expify gain` command. Standard values: `text = 20`, `voice = 10`, `video = 20` (XP/min).
- A random multiplier from `x0.8` to `x1.2` is applied to the base value in every XP calculation iteration. These multipliers are hardcoded and cannot be changed.
- Administrators can disable any XP types using `/expify toggle`. Disabled types won't be earned or displayed in `/top` and `/rank`.
- Moderators and admins can set objects to be ignored by the XP system using `/noxp`. Users in this list won't earn XP, activities in listed channels won't grant XP, and users with listed roles won't earn XP.
- Bots do not earn experience.

### Text Experience

Formula: `Base_Text * 0.8~1.2`

All rules above apply.
- A user receives XP if a message event from them occurred during the current minute.
- Multiple messages per minute do not increase the XP amount; experience is granted for the fact of activity in text channels to prevent spamming.

### Voice Experience

Formula: `Base_Voice * 0.8~1.2`

All rules above apply.
Popular leveling systems have significant flaws that I had to address. These rules help avoid extra server regulations and the need for moderators to manually monitor "XP farming."

- A user receives XP for every minute spent in a voice channel.
- A user does **not** receive XP if they are alone in the channel or with only a bot.
- A user does **not** receive XP if their microphone is muted.
- A user does **not** receive XP if all other participants in the channel are muted except for the user themselves.

### Video Experience

Formula: `Base_Video * 0.8~1.2 + (Base_Video * 0.25) * 0.8~1.2`

All rules above apply. This type is often missing in many leveling systems, but I decided to implement it to reward extra activity in voice chats while maintaining fair competition for voice XP, as not everyone can stream or use a webcam.

- A user receives video XP for every minute of active screen sharing or webcam use in a voice channel.
- The number of viewers does not affect the amount of XP earned.
- For an enabled webcam, the user receives the full base experience multiplied by the current iteration's multiplier. Webcams are used less frequently, making them more valuable.
- For an enabled screen share, the user receives 25% of the base experience multiplied by the multiplier. This multiplier is lower because many users share their screens nearly 80% of the time they are in a channel. If you want to make video XP easier to get, the admin can increase the base value from `20` XP up to `100` XP.
- If a participant has both screen sharing and a webcam enabled, the experience for both is summed. Example: `20 * 0.95 + (20 * 0.25) * 0.95 = 23.75 = 24`.
- A user does **not** receive XP if they are alone in the channel or with only a bot.
- A user does **not** receive XP if their microphone is muted.
- A user does **not** receive XP if all other participants in the channel are muted.

# Rewards and Modes

Rewards are distributed every few minutes based on recent activity if the user meets the requirements. If an announcement channel is set in `/expify channels`, a notification will be sent as an embed to avoid unnecessary pings.

### Reward Modes

You can change the reward delivery mode using the `/reward mode` command.

In the standard mode (**Keep all rewards**), all rewards the user qualifies for are granted.

- No additional conditions.

In the (**Keep only the highest rewards**) mode, users receive roles they qualify for, but if a role has a single XP type requirement and the user already has a lower-level role of that same type, the old role is removed upon granting the new one. Combined rewards are not affected and are granted as usual.

Example: (⌨️: Text XP, 🎙️: Voice XP, 🎦: Video XP)

- `Role 1` requires: (⌨️ 45 LVL) + (🎙️ 45 LVL) + (🎦 45 LVL) - Combined
- `Role 2` requires: (⌨️ 50 LVL) + (🎙️ 60 LVL) - Combined
- `Role 3` requires: (🎙️ 45 LVL) - Single type
- `Role 4` requires: (🎙️ 60 LVL) - Single type
- `Role 5` requires: (🎦 75 LVL) - Single type

A user has already earned `Role 1` and `Role 3`. Their current levels are: (⌨️ 56 LVL) + (🎙️ 59 LVL) + (🎦 74 LVL). They don't yet qualify for `Role 2`, `Role 5`, or `Role 4`.

Now the user earns (🎙️ 60 LVL) and (🎦 75 LVL). Total: (⌨️ 56 LVL) + (🎙️ 60 LVL) + (🎦 75 LVL). They now qualify for `Role 2`, `Role 4`, and `Role 5`. If the "Keep highest only" mode is enabled, the bot will:

- Grant `Role 2`, `Role 4`, and `Role 5`.
- Since the user has a lower-level role of the same type as `Role 4` (`Role 3`), the bot will remove `Role 3`.
- `Role 5` has no lower-level equivalents, so nothing else is removed.
- `Role 1` is kept even with `Role 2` because they are combined roles and are not compared for removal.

# Access Levels

The bot does not use a custom permission system. Rights to see and use commands are safely restricted via Discord's permission bitmaps.

- Commands `/rank`, `/ping`, `/invite`, `/about` are available to all server members.
- Command `/top` is available only to members with "Manage Messages" permissions.
- Commands `/lang`, `/reward`, `/xp`, `/noxp` allow management of rewards, roles, and other parameters, and are available only to members with "Manage Roles" permissions.
- Command `/expify` and its subcommands allow dangerous actions typically configured once. It is available only to users with "Administrator" permissions.

# Migration

The bot includes a feature to sync currently assigned roles with the amount of experience users should have.

To do this, add these roles as rewards via `/reward add` with the required amount of XP. You can update them by using the same role in `/reward add` with new XP requirements. Check and find IDs using `/reward list`. Delete a reward using `/reward remove` with the reward ID.

To prevent a linear leaderboard (dozens of people with identical XP), the bot grants a slightly higher, randomized amount of XP. However, if a user has a very high level (100+), they might receive a significant boost depending on luck. The multiplier is recalculated for every XP type and every user. Formula: `Reward_XP * 1~1.0250`.

## Help Section
Info from `/expify migrate-help`:

👉 `/expify migrate` is a command used to restore progress from other bots or manual rewarding by matching configured rewards with the roles currently held by server members.

🚀 **How to start?**

- You need to create rewards in `/reward add` with specific requirements.
 
You can add up to 30 rewards at once and use multiple XP types for each.

⚡ **What will the bot do?**

Once you are sure about the role requirements (verify via `/reward list`), you can execute this command.

The bot will scan your rewards and check which roles users have on your server.

- If a person has one role from the rewards, the bot will grant them the XP amount for all types assigned to that role.
- If a person has multiple roles, the maximum reward value for each XP type will be used. For example, if (Role 1) gives 500 XP and (Role 2) gives 1,000 XP, the user will receive 1,000 XP.
- If a person already has more XP than the roles provide, their earned XP remains untouched.
To make the leaderboard less linear after migration, each person randomly receives up to x1.025 XP from the base value. Active users will easily be able to overtake inactive ones.

❗**PLEASE NOTE**

- Be careful: the bot will overwrite XP values that fall under the conditions above. This action cannot be undone!
- **`/expify migrate` can be used no more than once a week!**

# Restricting the `/rank` Command to a Specific Channel

You can do this via the `/expify channels` command by selecting the appropriate section.

Note that this does not restrict usage entirely: users can still use it in any channel, but the response (regardless of arguments) will be shown only to that user (ephemeral), not to everyone in the chat. If you set a channel restriction, it works like this:

- If used outside the allowed channel: the response is visible ONLY to the user who ran the command.
- If used in the allowed channel: it will be published for everyone, even if the user set the public argument to `false`.

# Localization

The bot supports multiple languages and always responds in your interface language if supported. However, reward notifications and administrative events will use the server's default language.
To change the language for automated messages independent of command responses, use the `/lang` command. If your interface language is supported, it will be set as the server's primary language. If not, you can pick one from the list.

If you want to help translate the bot into your language, you can create an [issue](https://github.com/SHULKERPLAY/discord-expify/issues) or submit a [Pull Request](https://github.com/SHULKERPLAY/discord-expify/pulls) with changes to [locales.json](https://github.com/SHULKERPLAY/discord-expify/blob/prod/locales.json).

# Viewing Your Level

Any user can check their level by typing `/rank`. The command displays your level, total XP, and progress toward the next level for all XP types enabled on the server. If channel restrictions are in place, you may only be able to see the response privately.

# Managing Experience Points on the Server

To perform operations with user XP, use the `/xp` command. For example, use `/xp add` to grant XP and `/xp remove` to take it away. You can set a user's level directly using `/xp set-level` or reset a specific XP type (or all) using `/xp reset`.

For flexible calculations, the `/xp calc` command helps you determine the total XP required for a specific level or the level corresponding to a specific XP amount.

## Resetting Experience for All Members

If you need to reset the progress of all server users, an administrator can use `/expify xp-reset`. This action is irreversible as users are removed from the database until they earn XP again.

To revoke user rewards, use `/expify cleanup-rewards`. Description [available below](#revoking-rewards-from-members-who-dont-meet-requirements).

## Disabling Any Type of Experience

Using `/expify toggle`, administrators can enable/disable Text, Audio, or Video XP in any combination. Users won't lose earned XP for disabled types, but they won't see it in `/rank` or earn more until it's re-enabled. `/top` also doesn't show disabled types.

## Blacklisting Users/Roles/Channels from Gaining XP

You can prevent "farmers" or specific users from gaining XP, or exclude AFK and spam channels. Use:

- `/noxp channel` - Add channels where no XP is granted.
- `/noxp user` - Add specific users who cannot earn XP.
- `/noxp role` - Add roles that prevent XP gain.

To remove an item from the list, run the command again with that item. For example, to remove `@role1`, run `/noxp role @role1` again.

The list size is limited per server. Check your current list and available space with `/noxp list`. Use `/noxp reset` to clear a list if you encounter issues with deleted Discord objects.

## Setting Custom Base XP Per Minute

The XP calculation formula is roughly `Base * 0.8~1.2`. You can control the `Base` value via `/expify gain`. Pick the XP type and set the base value between `5` and `100`. To see current settings, use `/expify get`.

# Managing Server Rewards

As mentioned in the [Rewards and Modes](#rewards-and-modes) section, you can add rewards for specific XP types or combined rewards.

## Adding a Reward

Use `/reward add`. Specify the role and one to three level requirements. Once a member meets all conditions, the role will be granted shortly after. The bot will provide the reward ID upon success.

## Updating a Reward

To update a reward, run `/reward add` again with the same role but new requirements. The system doesn't allow one role to be part of two different rewards, so it will update the existing one.

## Removing a Reward

Use `/reward remove` with the reward ID (found via `/reward list`).

## Viewing the Reward List

Run `/reward list` to see all configured rewards, roles, requirements, IDs, and the current reward mode.

## Revoking Rewards from Members Who Don't Meet Requirements

This is useful after an XP reset or a reward overhaul. Admins can use `/expify cleanup-rewards`. 

- The bot compares existing rewards with users' roles. If a user has a role listed in rewards but doesn't meet the XP requirement, the role is removed.
- Roles removed from the list *before* cleanup won't be checked or removed.
- Cleanup can only be run once a week.

Please respect your users' progress and avoid resetting XP without a valid reason.

# Displaying the Server Leaderboard

Members with "Manage Messages" permissions can use `/top`. Select the XP type, page number, and whether to make the response public (`public: true`). Max 10 entries per page.

# Viewing Server Settings

Settings are divided into four sections in `/expify get`:

- **XP Gaining**: Shows enabled XP types and current XP/min rates.
- **Channels**: Shows configured notification and ranking channels.
- **Ignored Objects**: Alias for `/noxp list`.
- **Rewards**: Alias for `/rewards list`.

# Configuring Channels for Bot Notifications

Set channels for specific events using `/expify channels`. Leave the channel field empty to disable a category.

- **Reward Announcements**: Sends an embed when rewards are granted.
- **Administrative Notifications**: Sends alerts about reward errors or major admin actions.
- [**Rank Channel**](#restricting-the-rank-command-to-a-specific-channel): Restricts where `/rank` can be posted publicly.

# Other
Create an Issue in this repository in case of problems. You can contact me on [our Discord server](https://discord.gg/e2HcXrQ) `@shulkerplay`.