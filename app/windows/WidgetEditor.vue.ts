import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { TObsFormData } from 'components/obs/inputs/ObsInput';
import GenericForm from 'components/obs/inputs/GenericForm';
import { ProjectorService } from 'services/projector';
import ModalLayout from 'components/ModalLayout.vue';
import Tabs from 'components/Tabs.vue';
import Display from 'components/shared/Display.vue';
import VFormGroup from 'components/shared/inputs/VFormGroup.vue';
import TestWidgets from 'components/TestWidgets.vue';
import { ToggleInput, NumberInput } from 'components/shared/inputs/inputs';
import { IWidgetData, IWidgetsServiceApi } from 'services/widgets';
import cloneDeep from 'lodash/cloneDeep';
import { IWidgetNavItem } from 'components/widgets/WidgetSettings.vue';
import CustomFieldsEditor from 'components/widgets/CustomFieldsEditor.vue';
import CodeEditor from 'components/widgets/CodeEditor.vue';
import { WindowsService } from 'services/windows';
import { IAlertBoxVariation } from 'services/widgets/settings/alert-box/alert-box-api';
import { ERenderingMode } from '../../../obs-api';

@Component({
  components: {
    ModalLayout,
    Tabs,
    ToggleInput,
    NumberInput,
    GenericForm,
    VFormGroup,
    TestWidgets,
    Display,
    CustomFieldsEditor,
    CodeEditor,
  },
})
export default class WidgetEditor extends Vue {
  @Inject() private widgetsService: IWidgetsServiceApi;
  @Inject() private windowsService: WindowsService;
  @Inject() private projectorService: ProjectorService;

  @Prop() isAlertBox?: boolean;
  @Prop() selectedId?: string;
  @Prop() selectedAlert?: string;

  /**
   * Declaration of additional sections in the right panel
   * @see example of usage in TipJar.vue.ts
   */
  @Prop() slots?: IWidgetNavItem[];

  /**
   * Navigation items for the right panel
   */
  @Prop() navItems: IWidgetNavItem[];

  $refs: { content: HTMLElement; sidebar: HTMLElement; code: HTMLElement };

  sourceId = this.windowsService.getChildWindowOptions().queryParams.sourceId;
  widget = this.widgetsService.getWidgetSource(this.sourceId);
  apiSettings = this.widget.getSettingsService().getApiSettings();
  properties: TObsFormData = [];
  codeTabs = [
    { value: 'HTML', name: $t('HTML') },
    { value: 'CSS', name: $t('CSS') },
    { value: 'JS', name: $t('JS') },
  ];
  currentTopTab = 'editor';
  currentCodeTab = 'HTML';
  currentSetting = this.navItems[0].value;
  readonly settingsState = this.widget.getSettingsService().state;
  animating = false;
  canShowEditor = false;

  get hideStyleBlockers() {
    return this.windowsService.state.child.hideStyleBlockers;
  }

  get loaded() {
    return !!this.settingsState.data;
  }

  get loadingFailed() {
    return !this.loaded && this.settingsState.loadingState === 'fail';
  }

  get wData(): IWidgetData {
    if (!this.settingsState.data) return null;
    return cloneDeep(this.settingsState.data) as IWidgetData;
  }

  get selectedVariation() {
    if (!this.selectedAlert || !this.selectedId || this.selectedAlert === 'general') return;
    return this.wData.settings[this.selectedAlert].variations.find(
      (variation: IAlertBoxVariation) => variation.id === this.selectedId,
    );
  }

  get customCodeIsEnabled() {
    if (this.selectedVariation) {
      return this.selectedVariation.settings.customHtmlEnabled;
    }
    return this.wData && this.wData.settings.custom_enabled;
  }

  get isSaving() {
    return this.settingsState.pendingRequests > 0;
  }

  mounted() {
    const source = this.widget.getSource();
    this.properties = source ? source.getPropertiesFormData() : [];

    // create a temporary previewSource while current window is shown
    this.widget.createPreviewSource();

    // some widgets have CustomFieldsEditor
    if (this.apiSettings.customFieldsAllowed) {
      this.codeTabs.push({ value: 'customFields', name: $t('Custom Fields') });
    }
  }

  destroyed() {
    this.widget.destroyPreviewSource();
  }

  get windowTitle() {
    const source = this.widget.getSource();
    return $t('Settings for ') + source.name;
  }

  get sourceProperties() {
    return this.properties.slice(4);
  }

  get topProperties() {
    return this.properties.slice(1, 4);
  }

  createProjector() {
    this.projectorService.createProjector(
      ERenderingMode.OBS_MAIN_RENDERING,
      this.widget.previewSourceId,
    );
  }

  retryDataFetch() {
    const service = this.widget.getSettingsService();
    service.fetchData();
  }

  onPropsInputHandler(properties: TObsFormData, changedIndex: number) {
    const source = this.widget.getSource();
    source.setPropertiesFormData([properties[changedIndex]]);
    this.properties = this.widget.getSource().getPropertiesFormData();
  }

  get topTabs() {
    const firstTab = [{ value: 'editor', name: $t('Widget Editor') }];
    if (this.selectedAlert === 'general') {
      return firstTab;
    }
    return this.apiSettings.customCodeAllowed
      ? firstTab.concat([{ value: 'code', name: $t('HTML CSS') }])
      : firstTab;
  }

  updateTopTab(value: string) {
    if (value === this.currentTopTab) return;
    this.animating = true;
    this.currentTopTab = value;
    // Animation takes 600ms to complete before we can re-render the OBS display
    setTimeout(() => {
      this.animating = false;
      this.canShowEditor = true; // vue-codemirror has rendering issues if we attempt to animate it just after mount
    }, 600);
  }

  updateCodeTab(value: string) {
    this.currentCodeTab = value;
  }

  updateCurrentSetting(value: string) {
    this.currentSetting = value;
  }

  @Watch('selectedAlert')
  autoselectCurrentSetting() {
    this.currentSetting = this.navItems[0].value;
  }

  toggleCustomCode(enabled: boolean) {
    this.widget
      .getSettingsService()
      .toggleCustomCode(enabled, this.wData.settings, this.selectedVariation);
  }
}