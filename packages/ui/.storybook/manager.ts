// Modified 2026 by Treslibre Project (Treslibre).
import {addons} from 'storybook/manager-api';
import {create} from 'storybook/theming';

const theme = create({
    base: 'light',
    brandTitle: 'Treslibre UI',
    brandUrl: 'https://github.com/Treslibre/treslibre-desktop',
    brandTarget: '_self',
});

addons.setConfig({
    theme,
});
