const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  FileBuilder,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ChannelSelectMenuBuilder
} = require('discord.js');

const DEFAULT_COLOR = 0x2F3136;
const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link
};
const SELECT_BUILDERS = {
  string: StringSelectMenuBuilder,
  user: UserSelectMenuBuilder,
  role: RoleSelectMenuBuilder,
  mentionable: MentionableSelectMenuBuilder,
  channel: ChannelSelectMenuBuilder
};

const MAX_REMOTE_FILE_BYTES = Math.max(
  1_048_576,
  Math.min(50 * 1_024 * 1_024, Number(process.env.BWW_MAX_FILE_BYTES) || 20 * 1_024 * 1_024)
);

function sanitizeFilename(value, fallback = 'bww-file.bin') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
  return cleaned || fallback;
}

function isBlockedRemoteHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^127(?:\\.\\d{1,3}){3}$/.test(host)) return true;
  if (/^10(?:\\.\\d{1,3}){3}$/.test(host)) return true;
  if (/^192\\.168(?:\\.\\d{1,3}){2}$/.test(host)) return true;
  const private172 = host.match(/^172\\.(\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}$/);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
  return false;
}

async function fetchRemoteFile(inputUrl) {
  let currentUrl = String(inputUrl || '').trim();
  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(currentUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('File-URL muss http:// oder https:// verwenden.');
    }
    if (isBlockedRemoteHost(parsed.hostname)) {
      throw new Error('Diese File-URL zeigt auf einen nicht erlaubten privaten Host.');
    }

    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'BWW-Discord-Bot/1.0' }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('File-Weiterleitung ohne Ziel.');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Datei konnte nicht geladen werden (HTTP ${response.status}).`);
    }

    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_REMOTE_FILE_BYTES) {
      throw new Error(`Datei ist zu groß. Maximum: ${Math.floor(MAX_REMOTE_FILE_BYTES / 1_048_576)} MB.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_REMOTE_FILE_BYTES) {
      throw new Error(`Datei ist zu groß. Maximum: ${Math.floor(MAX_REMOTE_FILE_BYTES / 1_048_576)} MB.`);
    }
    return buffer;
  }

  throw new Error('Zu viele File-Weiterleitungen.');
}

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

function safeText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function buildButton(data = {}) {
  const style = BUTTON_STYLES[String(data.style || 'secondary')] || ButtonStyle.Secondary;
  const button = new ButtonBuilder().setStyle(style);

  if (data.label) button.setLabel(safeText(data.label, 80));
  if (data.emoji) {
    try { button.setEmoji({ name: safeText(data.emoji, 100) }); } catch {}
  }

  if (style === ButtonStyle.Link) {
    if (!data.url) throw new Error('Link-Button benötigt eine URL.');
    button.setURL(safeText(data.url, 512));
  } else {
    button.setCustomId(safeText(data.customId || `bww_embed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, 100));
    if (data.disabled) button.setDisabled(true);
  }

  return button;
}

function buildSelect(data = {}) {
  const type = SELECT_BUILDERS[data.kind] ? data.kind : 'string';
  const SelectBuilder = SELECT_BUILDERS[type];
  const menu = new SelectBuilder()
    .setCustomId(safeText(data.customId || `bww_embed_select_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, 100));

  if (data.placeholder) menu.setPlaceholder(safeText(data.placeholder, 150));
  if (data.disabled) menu.setDisabled(true);
  if (Number.isInteger(Number(data.minValues))) menu.setMinValues(Math.max(0, Math.min(25, Number(data.minValues))));
  if (Number.isInteger(Number(data.maxValues))) menu.setMaxValues(Math.max(1, Math.min(25, Number(data.maxValues))));

  if (type === 'string') {
    const options = Array.isArray(data.options) ? data.options.slice(0, 25) : [];
    if (!options.length) throw new Error('String-Select benötigt mindestens eine Option.');
    const maxValues = Math.max(1, Math.min(options.length, Number(data.maxValues) || 1));
    const minValues = Math.max(0, Math.min(maxValues, Number(data.minValues) || 1));
    menu.setMinValues(minValues).setMaxValues(maxValues);
    menu.addOptions(options.map((option) => {
      const item = new StringSelectMenuOptionBuilder()
        .setLabel(safeText(option.label || option.value || 'Option', 100))
        .setValue(safeText(option.value || option.label || 'option', 100));
      if (option.description) item.setDescription(safeText(option.description, 100));
      if (option.emoji) {
        try { item.setEmoji({ name: safeText(option.emoji, 100) }); } catch {}
      }
      if (option.default) item.setDefault(true);
      return item;
    }));
  } else {
    if (Number.isInteger(Number(data.minValues))) menu.setMinValues(Math.max(0, Math.min(25, Number(data.minValues))));
    if (Number.isInteger(Number(data.maxValues))) menu.setMaxValues(Math.max(1, Math.min(25, Number(data.maxValues))));
  }

  return menu;
}

function buildComponentsV2(data = {}) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const container = new ContainerBuilder()
    .setAccentColor(normalizeColor(source.color))
    .setSpoiler(Boolean(source.spoiler));
  const components = Array.isArray(source.components) ? source.components.slice(0, 40) : [];
  let renderedComponents = 0;

  for (const component of components) {
    const type = component?.type;

    if (type === 'text') {
      const content = safeText(component.content, 4000);
      if (content) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
        renderedComponents++;
      }
      continue;
    }

    if (type === 'separator') {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(String(component.spacing) === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
          .setDivider(component.divider !== false)
      );
      renderedComponents++;
      continue;
    }

    if (type === 'file') {
      const fileUrl = safeText(component.url, 1000);
      if (!/^attachment:\/\//i.test(fileUrl)) {
        throw new Error('File Component benötigt eine vorbereitete attachment://-URL.');
      }
      const file = new FileBuilder()
        .setURL(fileUrl)
        .setSpoiler(Boolean(component.spoiler));
      container.addFileComponents(file);
      renderedComponents++;
      continue;
    }

    if (type === 'media_gallery') {
      const items = Array.isArray(component.items)
        ? component.items.slice(0, 10).filter((item) => item?.url)
        : [];
      if (!items.length) continue;
      const gallery = new MediaGalleryBuilder().addItems(
        ...items.map((item) =>
          new MediaGalleryItemBuilder()
            .setURL(safeText(item.url, 1000))
            .setDescription(safeText(item.description || '', 1024))
            .setSpoiler(Boolean(item.spoiler))
        )
      );
      container.addMediaGalleryComponents(gallery);
      renderedComponents++;
      continue;
    }

    if (type === 'section') {
      const texts = Array.isArray(component.texts)
        ? component.texts.slice(0, 3).map((value) => safeText(value, 4000)).filter(Boolean)
        : [];
      if (!texts.length) continue;

      const section = new SectionBuilder().addTextDisplayComponents(
        ...texts.map((content) => new TextDisplayBuilder().setContent(content))
      );

      if (component.accessory?.type === 'thumbnail' && component.accessory.url) {
        section.setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(safeText(component.accessory.url, 1000))
            .setDescription(safeText(component.accessory.description || '', 1024))
            .setSpoiler(Boolean(component.accessory.spoiler))
        );
      } else if (component.accessory?.type === 'button') {
        section.setButtonAccessory(buildButton(component.accessory));
      }

      container.addSectionComponents(section);
      renderedComponents++;
      continue;
    }

    if (type === 'buttons') {
      const buttons = Array.isArray(component.buttons) ? component.buttons.slice(0, 5) : [];
      if (!buttons.length) continue;
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(...buttons.map((button) => buildButton(button)))
      );
      renderedComponents++;
      continue;
    }

    if (type === 'select') {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(buildSelect(component))
      );
      renderedComponents++;
    }
  }

  if (!components.length) {
    const title = safeText(source.title, 256);
    const description = safeText(source.description, 4000);
    const footer = safeText(source.footer, 1000);
    const thumbnail = safeText(source.thumbnail, 1000);
    const image = safeText(source.image, 1000);

    if (thumbnail && (title || description)) {
      try {
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent([title && '## ' + title, description].filter(Boolean).join('\\n'))
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
        );
        renderedComponents++;
      } catch {}
    } else {
      if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ' + title));
        renderedComponents++;
      }
      if (description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
        renderedComponents++;
      }
    }

    if (image) {
      try {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(image).setDescription(title || 'Bild')
          )
        );
        renderedComponents++;
      } catch {}
    }

    if (footer) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
      );
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# ' + footer));
      renderedComponents += 2;
    }
  }

  if (!renderedComponents) {
    throw new Error('Components-V2-Nachricht enthält keine gültigen Inhalte.');
  }

  return container;
}

async function prepareEmbedV2(data = {}) {
  const source = data && typeof data === 'object' && !Array.isArray(data)
    ? JSON.parse(JSON.stringify(data))
    : {};
  const components = Array.isArray(source.components) ? source.components : [];
  const attachments = [];
  const usedNames = new Set();

  for (const component of components) {
    if (component?.type !== 'file') continue;

    const sourceUrl = String(component.url || '').trim();
    if (!sourceUrl) throw new Error('File Component benötigt eine Datei-URL.');

    let filename = sanitizeFilename(component.filename);
    const original = filename;
    let suffix = 2;
    while (usedNames.has(filename)) {
      filename = original.includes('.')
        ? original.replace(/(\.[^./]+)$/, `-${suffix++}$1`)
        : `${original}-${suffix++}`;
    }
    usedNames.add(filename);

    const buffer = await fetchRemoteFile(sourceUrl);
    attachments.push(
      new AttachmentBuilder(buffer)
        .setName(filename)
        .setDescription(safeText(component.description || '', 1024))
        .setSpoiler(Boolean(component.spoiler))
    );

    component.url = `attachment://${filename}`;
  }

  return {
    container: buildComponentsV2(source),
    attachments
  };
}

function embedV2(options = {}) {
  return buildComponentsV2(options);
}

function welcomeComponents(message, member, options = {}) {
  const text = resolveWelcomeText(message, member);
  const title = options.title ? resolveWelcomeText(options.title, member) : null;
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const container = new ContainerBuilder().setAccentColor(DEFAULT_COLOR);

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title ? `## ${title}\n${text}` : text)
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
    new TextDisplayBuilder().setContent(`## Verifizierung\n${String(config.verify.message || '') .slice(0, 3800)}`)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success)
    )
  );
  return container;
}

module.exports = {
  embedV2,
  buildComponentsV2,
  prepareEmbedV2,
  welcomeComponents,
  verifyComponents,
  resolveWelcomeText,
  normalizeColor
};
