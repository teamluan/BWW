const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const DEFAULT_COLOR = 0x2F3136;

function resolveWelcomeText(text, member) {
  return String(text || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName || member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{id}', member.id)
    .replaceAll('{count}', String(member.guild.memberCount));
}

function normalizeColor(value, fallback = DEFAULT_COLOR) {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  return parseInt(raw, 16);
}

function embedV2(options = {}) {
  const container = new ContainerBuilder().setAccentColor(normalizeColor(options.color));

  const title = String(options.title || '').trim().slice(0, 256);
  const description = String(options.description || '').trim().slice(0, 4000);
  const footer = String(options.footer || '').trim().slice(0, 1000);
  const image = String(options.image || '').trim();
  const thumbnail = String(options.thumbnail || '').trim();

  if (title) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
  }

  if (description) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
  }

  if (thumbnail) {
    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description || '\u200b'))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
      if (title || description) container.addSectionComponents(section);
    } catch {}
  }

  if (image) {
    try {
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(image).setDescription(title || 'Bild')
      );
      container.addMediaGalleryComponents(gallery);
    } catch {
      if (description) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(image)
        );
      }
    }
  }

  if (footer) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footer}`)
    );
  }

  if (!title && !description && !image && !thumbnail && !footer) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## BWW Embed V2\nKeine Inhalte angegeben.')
    );
  }

  return container;
}

function welcomeComponents(message, member, options = {}) {
  const text = resolveWelcomeText(message, member);
  const title = options.title ? resolveWelcomeText(options.title, member) : null;
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const container = new ContainerBuilder().setAccentColor(DEFAULT_COLOR);

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        title ? `## ${title}\n${text}` : text
      )
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL(avatar)
        .setDescription(`Avatar von ${member.user.username}`)
    );

  container.addSectionComponents(section);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:F>`)
  );
  return container;
}

function verifyComponents(config) {
  const container = new ContainerBuilder().setAccentColor(DEFAULT_COLOR);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Verifizierung\n${String(config.verify.message || '').slice(0, 3800)}`)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('bww_verify')
        .setLabel('Verifizieren')
        .setStyle(ButtonStyle.Success)
    )
  );
  return container;
}

module.exports = {
  embedV2,
  welcomeComponents,
  verifyComponents,
  resolveWelcomeText,
  normalizeColor
};
