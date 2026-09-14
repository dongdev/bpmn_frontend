import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { CamundaService } from '../../api/camunda.service';
import { FormRepositoryService, FormRecord } from '../../api/form-repository.service';
import { WorkflowRepositoryService, WorkflowRecord } from '../../api/workflow-repository.service';
import { AuthService } from '../../api/auth.service';
import { PERMISSIONS } from '../../config/constants';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule
} from 'bpmn-js-properties-panel';
import camundaModdleDescriptor from 'camunda-bpmn-moddle/resources/camunda.json';

@Component({
  selector: 'app-workflow-manager',
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
  templateUrl: './workflow-manager.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class WorkflowManagerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  currentSortField = 'updatedAt';
  currentSortOrder = 'desc';

  @ViewChild('bpmnCanvas', { static: false }) bpmnCanvas!: ElementRef;
  @ViewChild('bpmnProperties', { static: false }) bpmnProperties!: ElementRef;

  workflows: (WorkflowRecord & { isDeployed?: boolean; version?: number; camundaId?: string })[] = [];
  forms: FormRecord[] = [];
  isEditing = false;
  isNew = false;

  activeWfId = '';
  activeWfName = '';
  activeWfDesc = '';
  activeWfXml = '';

  private modeler: any = null;
  saveModalVisible = false;

  selectedElement: any = null;
  selectedFormKey = '';

  constructor(
    private camundaService: CamundaService,
    private wfRepository: WorkflowRepositoryService,
    private formRepository: FormRepositoryService,
    private message: NzMessageService,
    private modal: NzModalService,
    private ngZone: NgZone,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  ngOnInit() {
    this.loadForms();
    const urlSegments = this.route.snapshot.url.map(s => s.path);
    const id = this.route.snapshot.params['id'];

    if (urlSegments.includes('new')) {
      this.loadWorkflows();
      this.isEditing = true;
      this.isNew = true;
      this.activeWfId = `process_${Date.now()}`;
      this.activeWfName = 'Quy trình mới';
      this.activeWfDesc = '';
      this.activeWfXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_0e4i0cw" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="4.4.0">
  <bpmn:process id="${this.activeWfId}" name="${this.activeWfName}" isExecutable="true" camunda:historyTimeToLive="45">
    <bpmn:startEvent id="StartEvent_1" name="Bắt đầu" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${this.activeWfId}">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="99" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="179" y="142" width="37" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    } else if (urlSegments.includes('edit') && id) {
      this.loadWorkflows();
      const wf = this.wfRepository.getWorkflows().find(w => w.id === id);
      if (!wf) {
        this.router.navigate(['/dashboard/workflow-list']);
        return;
      }
      this.isEditing = true;
      this.isNew = false;
      this.activeWfId = wf.id;
      this.activeWfName = wf.name;
      this.activeWfDesc = wf.description || '';
      this.activeWfXml = wf.xml;
    } else {
      this.loadWorkflows();
    }
  }

  ngAfterViewInit() {
    if (this.isEditing && this.activeWfXml) {
      setTimeout(() => this.initModeler(this.activeWfXml), 100);
    }
  }

  ngOnDestroy() {
    this.destroyModeler();
  }

  async loadWorkflows(sortField?: string, sortOrder?: string) {
    if (sortField) this.currentSortField = sortField;
    if (sortOrder) this.currentSortOrder = sortOrder;

    // 1. Get local designed workflows
    const localWorkflows = this.wfRepository.getWorkflows(this.currentSortField, this.currentSortOrder);

    // 2. Fetch deployed Process Definitions from Camunda REST Engine via BFF Gateway
    try {
      const camundaDefs = await this.camundaService.getProcessDefinitions();
      const existingKeys = new Set(localWorkflows.map(w => w.id));

      localWorkflows.forEach(lw => {
        const matchingCamunda = camundaDefs.find(c => c.key === lw.id || c.name === lw.name);
        if (matchingCamunda) {
          (lw as any).isDeployed = true;
          (lw as any).version = matchingCamunda.version;
          (lw as any).camundaId = matchingCamunda.id;
        }
      });

      const externalWorkflows = camundaDefs
        .filter(def => !existingKeys.has(def.key) && !existingKeys.has(def.id))
        .map(def => ({
          id: def.key,
          name: def.name || def.key,
          description: `Quy trình đã Deploy trên Camunda (Phiên bản v${def.version})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          xml: '',
          isDeployed: true,
          version: def.version,
          camundaId: def.id
        }));

      this.workflows = [...localWorkflows, ...externalWorkflows];
    } catch (e) {
      console.warn('Không thể lấy danh sách Process Definitions từ Camunda:', e);
      this.workflows = localWorkflows;
    }
  }

  onSortChange(field: string, order: string | null) {
    const mappedOrder = order === 'ascend' ? 'asc' : (order === 'descend' ? 'desc' : 'desc');
    this.loadWorkflows(field, mappedOrder);
  }

  async loadForms() {
    this.forms = await this.formRepository.getForms();
  }

  createNewWorkflow() {
    this.router.navigate(['/dashboard/workflow-list/new']);
  }

  editWorkflow(wf: WorkflowRecord) {
    this.router.navigate(['/dashboard/workflow-list/edit', wf.id]);
  }

  private initModeler(xml: string) {
    this.destroyModeler();

    if (!this.bpmnCanvas) {
      console.error('bpmnCanvas reference not available yet.');
      return;
    }

    this.modeler = new BpmnModeler({
      container: this.bpmnCanvas.nativeElement,
      propertiesPanel: {
        parent: this.bpmnProperties.nativeElement
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule
      ],
      moddleExtensions: {
        camunda: camundaModdleDescriptor
      },
      keyboard: {
        bindTo: window
      }
    });

    this.modeler.importXML(xml).then(({ warnings }: any) => {
      if (warnings && warnings.length > 0) {
        console.warn('Warnings during BPMN import', warnings);
      }
      (this.modeler as any)?.get('canvas').zoom('fit-viewport');

      const eventBus = this.modeler.get('eventBus');
      eventBus.on('selection.changed', (e: any) => {
        this.ngZone.run(() => {
          if (e.newSelection && e.newSelection.length > 0) {
            const element = e.newSelection[0];
            this.selectedElement = element;
            
            if (element.type === 'bpmn:UserTask' || element.type === 'bpmn:StartEvent') {
              const bo = element.businessObject;
              this.selectedFormKey = bo.get('formKey') || bo.get('camunda:formKey') || bo.formKey || '';
            } else {
              this.selectedFormKey = '';
            }
          } else {
            this.selectedElement = null;
            this.selectedFormKey = '';
          }
        });
      });

    }).catch((err: any) => {
      console.error('BPMN Import XML failed', err);
      this.message.error('Không thể vẽ sơ đồ BPMN: ' + err.message);
    });
  }

  private destroyModeler() {
    if (this.modeler) {
      this.modeler.destroy();
      this.modeler = null;
    }
  }

  updateFormKey() {
    if (!this.selectedElement || !this.modeler) return;
    
    const modeling = this.modeler.get('modeling');
    const bo = this.selectedElement.businessObject;

    // Use Moddle property name 'formKey' so camunda-bpmn-moddle correctly serializes to camunda:formKey in BPMN XML
    modeling.updateProperties(this.selectedElement, {
      formKey: this.selectedFormKey || undefined
    });

    if (bo && typeof bo.set === 'function') {
      bo.set('formKey', this.selectedFormKey || undefined);
    }

    this.message.success('Đã liên kết và lưu Form Key thành công!');
  }

  backToList() {
    this.modal.confirm({
      nzTitle: 'Xác nhận thoát',
      nzContent: 'Các thay đổi thiết kế chưa lưu sẽ bị mất. Bạn có chắc chắn muốn thoát?',
      nzOnOk: () => {
        this.destroyModeler();
        this.router.navigate(['/dashboard/workflow-list']);
      }
    });
  }

  openSaveModal() {
    this.saveModalVisible = true;
  }

  async confirmSave() {
    if (!this.activeWfName.trim()) {
      this.message.error('Tên quy trình không được để trống.');
      return;
    }

    try {
      if (this.modeler) {
        const { xml } = await this.modeler.saveXML({ format: true });
        if (xml) {
          this.activeWfXml = xml;
        }
      }

      this.wfRepository.saveWorkflow({
        id: this.activeWfId,
        name: this.activeWfName,
        description: this.activeWfDesc,
        xml: this.activeWfXml
      });

      this.message.success('Lưu quy trình thành công!');
      this.saveModalVisible = false;
      this.isNew = false;
    } catch (e: any) {
      this.message.error('Lỗi khi lưu quy trình: ' + e.message);
    }
  }

  async deployActiveWorkflow() {
    try {
      if (this.modeler) {
        const { xml } = await this.modeler.saveXML({ format: true });
        if (xml) {
          this.activeWfXml = xml;
        }
      }

      this.message.loading('Đang deploy lên Camunda Engine...', { nzDuration: 2000 });
      await this.camundaService.deployWorkflow(this.activeWfName, this.activeWfXml);
      this.message.success('Deploy quy trình lên Camunda Engine thành công!');

      this.wfRepository.saveWorkflow({
        id: this.activeWfId,
        name: this.activeWfName,
        description: this.activeWfDesc,
        xml: this.activeWfXml
      });
      this.isEditing = false;
      this.destroyModeler();
      this.loadWorkflows();
    } catch (e: any) {
      console.error(e);
      this.message.error('Lỗi deploy quy trình: ' + e.message);
    }
  }

  async deployWorkflowDirect(wf: WorkflowRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận Deploy',
      nzContent: `Bạn có muốn deploy quy trình "${wf.name}" lên Camunda Engine ngay lập tức không?`,
      nzOnOk: async () => {
        try {
          this.message.loading('Đang deploy...', { nzDuration: 2000 });
          await this.camundaService.deployWorkflow(wf.name, wf.xml);
          this.message.success('Deploy thành công!');
          this.loadWorkflows();
        } catch (e: any) {
          this.message.error('Lỗi deploy: ' + e.message);
        }
      }
    });
  }

  async runWorkflow(wf: WorkflowRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận Khởi chạy',
      nzContent: `Bạn có chắc chắn muốn khởi chạy Process Instance mới cho quy trình "${wf.name}" không?`,
      nzOnOk: async () => {
        try {
          this.message.loading('Đang khởi chạy...', { nzDuration: 2000 });
          await this.camundaService.startProcessInstanceByKey(wf.id);
          this.message.success('Khởi chạy Process Instance thành công! Bạn có thể kiểm tra ở Hộp thư công việc.');
        } catch (e: any) {
          this.message.error('Lỗi khi khởi chạy quy trình: ' + e.message);
        }
      }
    });
  }

  deleteWorkflow(wf: WorkflowRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận xóa',
      nzContent: `Bạn có chắc chắn muốn xóa thiết kế quy trình "${wf.name}" không?`,
      nzOnOk: () => {
        this.wfRepository.deleteWorkflow(wf.id);
        this.message.success('Xóa quy trình thành công!');
        this.loadWorkflows();
      }
    });
  }
}
