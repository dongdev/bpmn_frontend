import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CamundaService } from '../../api/camunda.service';
import { RuleRepositoryService, RuleRecord } from '../../api/rule-repository.service';
import { AuthService } from '../../api/auth.service';
import { PERMISSIONS } from '../../config/constants';

// Import dmn-js Modeler
import DmnModeler from 'dmn-js/lib/Modeler';
import camundaDmnModdleDescriptor from 'camunda-dmn-moddle/resources/camunda.json';

@Component({
  selector: 'app-rule-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzCardModule,
    NzModalModule,
    NzSpaceModule,
    NzIconModule,
    NzAlertModule,
    NzDividerModule,
    NzTagModule,
    NzSelectModule
  ],
  providers: [NzModalService, NzMessageService],
  templateUrl: './rule-manager.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class RuleManagerComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  @ViewChild('dmnCanvas', { static: false }) dmnCanvas!: ElementRef;

  rules: RuleRecord[] = [];
  groupedRules: Array<{ key: string; versions: RuleRecord[] }> = [];
  expandedGroups: Set<string> = new Set<string>();

  isEditing = false;
  isNew = false;

  currentSortField = 'updated_at';
  currentSortOrder = 'desc';

  async loadRules(sortField?: string, sortOrder?: string) {
    if (sortField) this.currentSortField = sortField;
    if (sortOrder) this.currentSortOrder = sortOrder;
    this.rules = await this.ruleRepository.getRules(this.currentSortField, this.currentSortOrder);
    this.groupRules();
  }

  onSortChange(field: string, order: string | null) {
    const mappedOrder = order === 'ascend' ? 'asc' : (order === 'descend' ? 'desc' : 'desc');
    this.loadRules(field, mappedOrder);
  }

  // Active DMN Rule state
  activeRuleId = '';
  activeRuleKey = '';
  activeRuleName = '';
  activeRuleDesc = '';
  activeRuleXml = '';
  activeRuleStatus = 'DRAFT';

  private modeler: any = null;
  saveModalVisible = false;

  constructor(
    private camundaService: CamundaService,
    private ruleRepository: RuleRepositoryService,
    private message: NzMessageService,
    private modal: NzModalService,
    private authService: AuthService
  ) {}

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  ngOnInit() {
    this.loadRules();
  }

  ngOnDestroy() {
    this.destroyModeler();
  }

  private groupRules() {
    const map: { [key: string]: RuleRecord[] } = {};
    this.rules.forEach(r => {
      if (!map[r.rule_key]) map[r.rule_key] = [];
      map[r.rule_key].push(r);
    });

    this.groupedRules = Object.keys(map).map(key => {
      // Sort versions descending
      const versions = map[key].sort((a, b) => b.version_no - a.version_no);
      return { key, versions };
    });

    // Expand groups by default
    this.groupedRules.forEach(g => this.expandedGroups.add(g.key));
  }

  toggleGroup(key: string) {
    if (this.expandedGroups.has(key)) {
      this.expandedGroups.delete(key);
    } else {
      this.expandedGroups.add(key);
    }
  }

  isGroupExpanded(key: string): boolean {
    return this.expandedGroups.has(key);
  }

  createNewRule() {
    this.isEditing = true;
    this.isNew = true;
    this.activeRuleId = '';
    this.activeRuleKey = `rule_${Date.now()}`;
    this.activeRuleName = 'Quyết định mới';
    this.activeRuleDesc = '';
    this.activeRuleStatus = 'DRAFT';

    // Default template for DMN decision table
    this.activeRuleXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" xmlns:camunda="http://camunda.org/schema/1.0/dmn" id="Definitions_${Date.now()}" name="DRD" namespace="http://camunda.org/schema/1.0/dmn" exporter="Camunda Modeler" exporterVersion="4.4.0">
  <decision id="${this.activeRuleKey}" name="${this.activeRuleName}" camunda:historyTimeToLive="45">
    <decisionTable id="DecisionTable_1">
      <input id="Input_1" label="Tham số đầu vào">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text>inputVar</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Kết quả đầu ra" name="outputVar" typeRef="string" />
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_1" dmnElementRef="${this.activeRuleKey}">
        <dc:Bounds height="80" width="180" x="160" y="80" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;

    setTimeout(() => this.initModeler(this.activeRuleXml), 100);
  }

  editRule(wf: RuleRecord) {
    this.isEditing = true;
    this.isNew = false;
    this.activeRuleId = wf.id || '';
    this.activeRuleKey = wf.rule_key;
    this.activeRuleName = wf.name;
    this.activeRuleDesc = wf.description || '';
    this.activeRuleStatus = wf.status;
    this.activeRuleXml = wf.schema;

    setTimeout(() => this.initModeler(this.activeRuleXml), 100);
  }

  private initModeler(xml: string) {
    this.destroyModeler();

    if (!this.dmnCanvas) {
      console.error('dmnCanvas element reference not found.');
      return;
    }

    this.modeler = new DmnModeler({
      container: this.dmnCanvas.nativeElement,
      moddleExtensions: {
        camunda: camundaDmnModdleDescriptor
      },
      keyboard: {
        bindTo: window
      }
    });

    this.modeler.importXML(xml).then(({ warnings }: any) => {
      if (warnings && warnings.length > 0) {
        console.warn('DMN warning', warnings);
      }
      
      // Focus on decision table view (instead of DRD) if available
      const activeView = this.modeler?.getActiveView();
      if (activeView && activeView.type !== 'decisionTable') {
        const views = this.modeler?.getViews() || [];
        const table = views.find((v: any) => v.type === 'decisionTable');
        if (table) {
          this.modeler?.getActiveViewer().destroy(); // destroy old viewer if needed
          this.modeler?.open(table);
        }
      }
    }).catch((err: any) => {
      console.error('Failed to import DMN XML', err);
      this.message.error('Không thể hiển thị bảng quyết định DMN: ' + err.message);
    });
  }

  private destroyModeler() {
    if (this.modeler) {
      this.modeler.destroy();
      this.modeler = null;
    }
  }

  backToList() {
    this.modal.confirm({
      nzTitle: 'Xác nhận thoát',
      nzContent: 'Các thay đổi thiết kế chưa lưu sẽ bị mất. Bạn có muốn thoát?',
      nzOnOk: () => {
        this.isEditing = false;
        this.destroyModeler();
        this.loadRules();
      }
    });
  }

  openSaveModal() {
    this.saveModalVisible = true;
  }

  async confirmSave() {
    if (!this.activeRuleName.trim()) {
      this.message.error('Tên Rule không được để trống.');
      return;
    }

    try {
      if (this.modeler) {
        const { xml } = await this.modeler.saveXML({ format: true });
        if (xml) {
          this.activeRuleXml = xml;
        }
      }

      const saved = await this.ruleRepository.saveRule({
        id: this.activeRuleId || undefined,
        rule_key: this.activeRuleKey,
        name: this.activeRuleName,
        description: this.activeRuleDesc,
        status: this.activeRuleStatus,
        schema: this.activeRuleXml,
        version_no: 1 // handled by repo
      });

      this.message.success(`Lưu DMN Rule thành công! (Phiên bản: ${saved.version_no})`);
      this.saveModalVisible = false;
      this.isEditing = false;
      this.destroyModeler();
      this.loadRules();
    } catch (e: any) {
      this.message.error('Lỗi khi lưu DMN Rule: ' + e.message);
    }
  }

  async deployActiveRule() {
    try {
      if (this.modeler) {
        const { xml } = await this.modeler.saveXML({ format: true });
        if (xml) {
          this.activeRuleXml = xml;
        }
      }

      this.message.loading('Đang deploy DMN Rule...', { nzDuration: 2000 });
      await this.camundaService.deployResource(this.activeRuleKey, this.activeRuleXml, '.dmn');
      this.message.success('Deploy DMN Rule lên Camunda Engine thành công!');

      // Save as APPROVED locally
      await this.ruleRepository.saveRule({
        id: this.activeRuleId || undefined,
        rule_key: this.activeRuleKey,
        name: this.activeRuleName,
        description: this.activeRuleDesc,
        status: 'APPROVED',
        schema: this.activeRuleXml,
        version_no: 1
      });

      this.isEditing = false;
      this.destroyModeler();
      this.loadRules();
    } catch (e: any) {
      this.message.error('Lỗi deploy DMN: ' + e.message);
    }
  }

  async deployRuleDirect(r: RuleRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận Deploy',
      nzContent: `Bạn có muốn deploy Rule quyết định "${r.name}" lên Camunda Engine ngay lập tức không?`,
      nzOnOk: async () => {
        try {
          this.message.loading('Đang deploy...', { nzDuration: 2000 });
          await this.camundaService.deployResource(r.rule_key, r.schema, '.dmn');
          this.message.success('Deploy DMN lên Camunda thành công!');
        } catch (e: any) {
          this.message.error('Lỗi deploy DMN: ' + e.message);
        }
      }
    });
  }

  approveRule(r: RuleRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận duyệt',
      nzContent: `Bạn có chắc chắn muốn Duyệt Rule "${r.name}" không?`,
      nzOnOk: async () => {
        try {
          r.status = 'APPROVED';
          await this.ruleRepository.saveRule(r);
          this.message.success('Duyệt thành công!');
          
          // Ask if they want to deploy
          this.modal.confirm({
            nzTitle: 'Deploy ngay',
            nzContent: 'Rule đã được Duyệt. Bạn có muốn deploy trực tiếp lên Camunda Engine bây giờ không?',
            nzOnOk: async () => {
              try {
                await this.camundaService.deployResource(r.rule_key, r.schema, '.dmn');
                this.message.success('Deploy thành công!');
              } catch (err: any) {
                this.message.error('Lỗi deploy: ' + err.message);
              }
            }
          });
          this.loadRules();
        } catch (e: any) {
          this.message.error('Lỗi khi duyệt rule: ' + e.message);
        }
      }
    });
  }

  deleteRule(r: RuleRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận xóa',
      nzContent: `Bạn có chắc chắn muốn xóa DMN Rule "${r.name}" (Phiên bản v${r.version_no}) không?`,
      nzOnOk: async () => {
        if (r.id) {
          await this.ruleRepository.deleteRule(r.id);
          this.message.success('Xóa rule thành công!');
          this.loadRules();
        }
      }
    });
  }
}
