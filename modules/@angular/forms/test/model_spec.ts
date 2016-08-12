/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {fakeAsync, flushMicrotasks, tick} from '@angular/core/testing';
import {AsyncTestCompleter, afterEach, beforeEach, ddescribe, describe, iit, inject, it, xit} from '@angular/core/testing/testing_internal';
import {FormArray, FormControl, FormGroup, Validators} from '@angular/forms';

import {EventEmitter} from '../src/facade/async';
import {isPresent} from '../src/facade/lang';

export function main() {
  function asyncValidator(expected: any /** TODO #9100 */, timeouts = {}) {
    return (c: any /** TODO #9100 */) => {
      var resolve: (result: any) => void;
      var promise = new Promise(res => { resolve = res; });
      var t = isPresent((timeouts as any /** TODO #9100 */)[c.value]) ?
          (timeouts as any /** TODO #9100 */)[c.value] :
          0;
      var res = c.value != expected ? {'async': true} : null;

      if (t == 0) {
        resolve(res);
      } else {
        setTimeout(() => { resolve(res); }, t);
      }

      return promise;
    };
  }

  function asyncValidatorReturningObservable(c: FormControl) {
    var e = new EventEmitter();
    Promise.resolve(null).then(() => { e.emit({'async': true}); });
    return e;
  }

  function otherAsyncValidator() { return Promise.resolve({'other': true}); }

  describe('Form Model', () => {
    describe('FormControl', () => {
      it('should default the value to null', () => {
        var c = new FormControl();
        expect(c.value).toBe(null);
      });

      describe('validator', () => {
        it('should run validator with the initial value', () => {
          var c = new FormControl('value', Validators.required);
          expect(c.valid).toEqual(true);
        });

        it('should rerun the validator when the value changes', () => {
          var c = new FormControl('value', Validators.required);
          c.setValue(null);
          expect(c.valid).toEqual(false);
        });

        it('should support arrays of validator functions if passed', () => {
          const c = new FormControl('value', [Validators.required, Validators.minLength(3)]);
          c.setValue('a');
          expect(c.valid).toEqual(false);

          c.setValue('aaa');
          expect(c.valid).toEqual(true);
        });

        it('should return errors', () => {
          var c = new FormControl(null, Validators.required);
          expect(c.errors).toEqual({'required': true});
        });

        it('should set single validator', () => {
          var c = new FormControl(null);
          expect(c.valid).toEqual(true);

          c.setValidators(Validators.required);

          c.setValue(null);
          expect(c.valid).toEqual(false);

          c.setValue('abc');
          expect(c.valid).toEqual(true);
        });

        it('should set multiple validators from array', () => {
          var c = new FormControl('');
          expect(c.valid).toEqual(true);

          c.setValidators([Validators.minLength(5), Validators.required]);

          c.setValue('');
          expect(c.valid).toEqual(false);

          c.setValue('abc');
          expect(c.valid).toEqual(false);

          c.setValue('abcde');
          expect(c.valid).toEqual(true);
        });

        it('should clear validators', () => {
          var c = new FormControl('', Validators.required);
          expect(c.valid).toEqual(false);

          c.clearValidators();
          expect(c.validator).toEqual(null);

          c.setValue('');
          expect(c.valid).toEqual(true);
        });

        it('should add after clearing', () => {
          var c = new FormControl('', Validators.required);
          expect(c.valid).toEqual(false);

          c.clearValidators();
          expect(c.validator).toEqual(null);

          c.setValidators([Validators.required]);
          expect(c.validator).not.toBe(null);
        });
      });

      describe('asyncValidator', () => {
        it('should run validator with the initial value', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             tick();

             expect(c.valid).toEqual(false);
             expect(c.errors).toEqual({'async': true});
           }));

        it('should support validators returning observables', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidatorReturningObservable);
             tick();

             expect(c.valid).toEqual(false);
             expect(c.errors).toEqual({'async': true});
           }));

        it('should rerun the validator when the value changes', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));

             c.setValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should run the async validator only when the sync validator passes', fakeAsync(() => {
             var c = new FormControl('', Validators.required, asyncValidator('expected'));
             tick();

             expect(c.errors).toEqual({'required': true});

             c.setValue('some value');
             tick();

             expect(c.errors).toEqual({'async': true});
           }));

        it('should mark the control as pending while running the async validation',
           fakeAsync(() => {
             var c = new FormControl('', null, asyncValidator('expected'));

             expect(c.pending).toEqual(true);

             tick();

             expect(c.pending).toEqual(false);
           }));

        it('should only use the latest async validation run', fakeAsync(() => {
             var c = new FormControl(
                 '', null, asyncValidator('expected', {'long': 200, 'expected': 100}));

             c.setValue('long');
             c.setValue('expected');

             tick(300);

             expect(c.valid).toEqual(true);
           }));

        it('should support arrays of async validator functions if passed', fakeAsync(() => {
             const c =
                 new FormControl('value', null, [asyncValidator('expected'), otherAsyncValidator]);
             tick();

             expect(c.errors).toEqual({'async': true, 'other': true});
           }));

        it('should add single async validator', fakeAsync(() => {
             var c = new FormControl('value', null);

             c.setAsyncValidators(asyncValidator('expected'));
             expect(c.asyncValidator).not.toEqual(null);

             c.setValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should add async validator from array', fakeAsync(() => {
             var c = new FormControl('value', null);

             c.setAsyncValidators([asyncValidator('expected')]);
             expect(c.asyncValidator).not.toEqual(null);

             c.setValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should clear async validators', fakeAsync(() => {
             var c = new FormControl('value', [asyncValidator('expected'), otherAsyncValidator]);

             c.clearValidators();

             expect(c.asyncValidator).toEqual(null);
           }));
      });

      describe('dirty', () => {
        it('should be false after creating a control', () => {
          const c = new FormControl('value');
          expect(c.dirty).toEqual(false);
        });

        it('should be true after changing the value of the control', () => {
          const c = new FormControl('value');
          c.markAsDirty();
          expect(c.dirty).toEqual(true);
        });
      });

      describe('touched', () => {
        it('should be false after creating a control', () => {
          const c = new FormControl('value');
          expect(c.touched).toEqual(false);
        });

        it('should be true after markAsTouched runs', () => {
          const c = new FormControl('value');
          c.markAsTouched();
          expect(c.touched).toEqual(true);
        });
      });

      describe('setValue', () => {
        let g: FormGroup, c: FormControl;
        beforeEach(() => {
          c = new FormControl('oldValue');
          g = new FormGroup({'one': c});
        });

        it('should set the value of the control', () => {
          c.setValue('newValue');
          expect(c.value).toEqual('newValue');
        });

        it('should invoke ngOnChanges if it is present', () => {
          let ngOnChanges: any;
          c.registerOnChange((v: any) => ngOnChanges = ['invoked', v]);

          c.setValue('newValue');

          expect(ngOnChanges).toEqual(['invoked', 'newValue']);
        });

        it('should not invoke on change when explicitly specified', () => {
          let onChange: any = null;
          c.registerOnChange((v: any) => onChange = ['invoked', v]);

          c.setValue('newValue', {emitModelToViewChange: false});

          expect(onChange).toBeNull();
        });

        it('should set the parent', () => {
          c.setValue('newValue');
          expect(g.value).toEqual({'one': 'newValue'});
        });

        it('should not set the parent when explicitly specified', () => {
          c.setValue('newValue', {onlySelf: true});
          expect(g.value).toEqual({'one': 'oldValue'});
        });

        it('should fire an event', fakeAsync(() => {
             c.valueChanges.subscribe((value) => { expect(value).toEqual('newValue'); });

             c.setValue('newValue');
             tick();
           }));

        it('should not fire an event when explicitly specified', fakeAsync(() => {
             c.valueChanges.subscribe((value) => { throw 'Should not happen'; });

             c.setValue('newValue', {emitEvent: false});
             tick();
           }));
      });

      describe('patchValue', () => {
        let g: FormGroup, c: FormControl;
        beforeEach(() => {
          c = new FormControl('oldValue');
          g = new FormGroup({'one': c});
        });

        it('should set the value of the control', () => {
          c.patchValue('newValue');
          expect(c.value).toEqual('newValue');
        });

        it('should invoke ngOnChanges if it is present', () => {
          let ngOnChanges: any;
          c.registerOnChange((v: any) => ngOnChanges = ['invoked', v]);

          c.patchValue('newValue');

          expect(ngOnChanges).toEqual(['invoked', 'newValue']);
        });

        it('should not invoke on change when explicitly specified', () => {
          let onChange: any = null;
          c.registerOnChange((v: any) => onChange = ['invoked', v]);

          c.patchValue('newValue', {emitModelToViewChange: false});

          expect(onChange).toBeNull();
        });

        it('should set the parent', () => {
          c.patchValue('newValue');
          expect(g.value).toEqual({'one': 'newValue'});
        });

        it('should not set the parent when explicitly specified', () => {
          c.patchValue('newValue', {onlySelf: true});
          expect(g.value).toEqual({'one': 'oldValue'});
        });

        it('should fire an event', fakeAsync(() => {
             c.valueChanges.subscribe((value) => { expect(value).toEqual('newValue'); });

             c.patchValue('newValue');
             tick();
           }));

        it('should not fire an event when explicitly specified', fakeAsync(() => {
             c.valueChanges.subscribe((value) => { throw 'Should not happen'; });

             c.patchValue('newValue', {emitEvent: false});

             tick();
           }));
      });

      describe('reset()', () => {
        let c: FormControl;

        beforeEach(() => { c = new FormControl('initial value'); });

        it('should restore the initial value of the control if passed', () => {
          c.setValue('new value');
          expect(c.value).toBe('new value');

          c.reset('initial value');
          expect(c.value).toBe('initial value');
        });

        it('should clear the control value if no value is passed', () => {
          c.setValue('new value');
          expect(c.value).toBe('new value');

          c.reset();
          expect(c.value).toBe(null);
        });

        it('should update the value of any parent controls with passed value', () => {
          const g = new FormGroup({'one': c});
          c.setValue('new value');
          expect(g.value).toEqual({'one': 'new value'});

          c.reset('initial value');
          expect(g.value).toEqual({'one': 'initial value'});
        });

        it('should update the value of any parent controls with null value', () => {
          const g = new FormGroup({'one': c});
          c.setValue('new value');
          expect(g.value).toEqual({'one': 'new value'});

          c.reset();
          expect(g.value).toEqual({'one': null});
        });


        it('should mark the control as pristine', () => {
          c.markAsDirty();
          expect(c.pristine).toBe(false);

          c.reset();
          expect(c.pristine).toBe(true);
        });

        it('should set the parent pristine state if all pristine', () => {
          const g = new FormGroup({'one': c});
          c.markAsDirty();
          expect(g.pristine).toBe(false);

          c.reset();
          expect(g.pristine).toBe(true);
        });

        it('should not set the parent pristine state if it has other dirty controls', () => {
          const c2 = new FormControl('two');
          const g = new FormGroup({'one': c, 'two': c2});
          c.markAsDirty();
          c2.markAsDirty();

          c.reset();
          expect(g.pristine).toBe(false);
        });

        it('should mark the control as untouched', () => {
          c.markAsTouched();
          expect(c.untouched).toBe(false);

          c.reset();
          expect(c.untouched).toBe(true);
        });

        it('should set the parent untouched state if all untouched', () => {
          const g = new FormGroup({'one': c});
          c.markAsTouched();
          expect(g.untouched).toBe(false);

          c.reset();
          expect(g.untouched).toBe(true);
        });

        it('should not set the parent untouched state if other touched controls', () => {
          const c2 = new FormControl('two');
          const g = new FormGroup({'one': c, 'two': c2});
          c.markAsTouched();
          c2.markAsTouched();

          c.reset();
          expect(g.untouched).toBe(false);
        });

        describe('reset() events', () => {
          let g: FormGroup, c2: FormControl, logger: any[];

          beforeEach(() => {
            c2 = new FormControl('two');
            g = new FormGroup({'one': c, 'two': c2});
            logger = [];
          });

          it('should emit one valueChange event per reset control', () => {
            g.valueChanges.subscribe(() => logger.push('group'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            c.reset();
            expect(logger).toEqual(['control1', 'group']);
          });

          it('should emit one statusChange event per reset control', () => {
            g.statusChanges.subscribe(() => logger.push('group'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));

            c.reset();
            expect(logger).toEqual(['control1', 'group']);
          });
        });

      });

      describe('valueChanges & statusChanges', () => {
        var c: any /** TODO #9100 */;

        beforeEach(() => { c = new FormControl('old', Validators.required); });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             c.valueChanges.subscribe({
               next: (value: any) => {
                 expect(c.value).toEqual('new');
                 expect(value).toEqual('new');
                 async.done();
               }
             });
             c.setValue('new');
           }));

        it('should fire an event after the status has been updated to invalid', fakeAsync(() => {
             c.statusChanges.subscribe({
               next: (status: any) => {
                 expect(c.status).toEqual('INVALID');
                 expect(status).toEqual('INVALID');
               }
             });

             c.setValue('');
             tick();
           }));

        it('should fire an event after the status has been updated to pending', fakeAsync(() => {
             var c = new FormControl('old', Validators.required, asyncValidator('expected'));

             var log: any[] /** TODO #9100 */ = [];
             c.valueChanges.subscribe({next: (value: any) => log.push(`value: '${value}'`)});

             c.statusChanges.subscribe({next: (status: any) => log.push(`status: '${status}'`)});

             c.setValue('');
             tick();

             c.setValue('nonEmpty');
             tick();

             c.setValue('expected');
             tick();

             expect(log).toEqual([
               '' +
                   'value: \'\'',
               'status: \'INVALID\'',
               'value: \'nonEmpty\'',
               'status: \'PENDING\'',
               'status: \'INVALID\'',
               'value: \'expected\'',
               'status: \'PENDING\'',
               'status: \'VALID\'',
             ]);
           }));

        // TODO: remove the if statement after making observable delivery sync
        it('should update set errors and status before emitting an event',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             c.valueChanges.subscribe((value: any /** TODO #9100 */) => {
               expect(c.valid).toEqual(false);
               expect(c.errors).toEqual({'required': true});
               async.done();
             });
             c.setValue('');
           }));

        it('should return a cold observable',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             c.setValue('will be ignored');
             c.valueChanges.subscribe({
               next: (value: any) => {
                 expect(value).toEqual('new');
                 async.done();
               }
             });
             c.setValue('new');
           }));
      });

      describe('setErrors', () => {
        it('should set errors on a control', () => {
          var c = new FormControl('someValue');

          c.setErrors({'someError': true});

          expect(c.valid).toEqual(false);
          expect(c.errors).toEqual({'someError': true});
        });

        it('should reset the errors and validity when the value changes', () => {
          var c = new FormControl('someValue', Validators.required);

          c.setErrors({'someError': true});
          c.setValue('');

          expect(c.errors).toEqual({'required': true});
        });

        it('should update the parent group\'s validity', () => {
          var c = new FormControl('someValue');
          var g = new FormGroup({'one': c});

          expect(g.valid).toEqual(true);

          c.setErrors({'someError': true});

          expect(g.valid).toEqual(false);
        });

        it('should not reset parent\'s errors', () => {
          var c = new FormControl('someValue');
          var g = new FormGroup({'one': c});

          g.setErrors({'someGroupError': true});
          c.setErrors({'someError': true});

          expect(g.errors).toEqual({'someGroupError': true});
        });

        it('should reset errors when updating a value', () => {
          var c = new FormControl('oldValue');
          var g = new FormGroup({'one': c});

          g.setErrors({'someGroupError': true});
          c.setErrors({'someError': true});

          c.setValue('newValue');

          expect(c.errors).toEqual(null);
          expect(g.errors).toEqual(null);
        });
      });
    });

    describe('FormGroup', () => {
      describe('value', () => {
        it('should be the reduced value of the child controls', () => {
          var g = new FormGroup({'one': new FormControl('111'), 'two': new FormControl('222')});
          expect(g.value).toEqual({'one': '111', 'two': '222'});
        });

        it('should be empty when there are no child controls', () => {
          var g = new FormGroup({});
          expect(g.value).toEqual({});
        });

        it('should support nested groups', () => {
          var g = new FormGroup({
            'one': new FormControl('111'),
            'nested': new FormGroup({'two': new FormControl('222')})
          });
          expect(g.value).toEqual({'one': '111', 'nested': {'two': '222'}});

          (<FormControl>(g.get('nested.two'))).setValue('333');

          expect(g.value).toEqual({'one': '111', 'nested': {'two': '333'}});
        });
      });

      describe('adding and removing controls', () => {
        it('should update value and validity when control is added', () => {
          var g = new FormGroup({'one': new FormControl('1')});
          expect(g.value).toEqual({'one': '1'});
          expect(g.valid).toBe(true);

          g.addControl('two', new FormControl('2', Validators.minLength(10)));

          expect(g.value).toEqual({'one': '1', 'two': '2'});
          expect(g.valid).toBe(false);
        });

        it('should update value and validity when control is removed', () => {
          var g = new FormGroup(
              {'one': new FormControl('1'), 'two': new FormControl('2', Validators.minLength(10))});
          expect(g.value).toEqual({'one': '1', 'two': '2'});
          expect(g.valid).toBe(false);

          g.removeControl('two');

          expect(g.value).toEqual({'one': '1'});
          expect(g.valid).toBe(true);
        });
      });

      describe('errors', () => {
        it('should run the validator when the value changes', () => {
          var simpleValidator = (c: any /** TODO #9100 */) =>
              c.controls['one'].value != 'correct' ? {'broken': true} : null;

          var c = new FormControl(null);
          var g = new FormGroup({'one': c}, null, simpleValidator);

          c.setValue('correct');

          expect(g.valid).toEqual(true);
          expect(g.errors).toEqual(null);

          c.setValue('incorrect');

          expect(g.valid).toEqual(false);
          expect(g.errors).toEqual({'broken': true});
        });
      });

      describe('dirty', () => {
        var c: FormControl, g: FormGroup;

        beforeEach(() => {
          c = new FormControl('value');
          g = new FormGroup({'one': c});
        });

        it('should be false after creating a control', () => { expect(g.dirty).toEqual(false); });

        it('should be true after changing the value of the control', () => {
          c.markAsDirty();

          expect(g.dirty).toEqual(true);
        });
      });


      describe('touched', () => {
        var c: FormControl, g: FormGroup;

        beforeEach(() => {
          c = new FormControl('value');
          g = new FormGroup({'one': c});
        });

        it('should be false after creating a control', () => { expect(g.touched).toEqual(false); });

        it('should be true after control is marked as touched', () => {
          c.markAsTouched();

          expect(g.touched).toEqual(true);
        });
      });

      describe('setValue', () => {
        let c: FormControl, c2: FormControl, g: FormGroup;

        beforeEach(() => {
          c = new FormControl('');
          c2 = new FormControl('');
          g = new FormGroup({'one': c, 'two': c2});
        });

        it('should set its own value', () => {
          g.setValue({'one': 'one', 'two': 'two'});
          expect(g.value).toEqual({'one': 'one', 'two': 'two'});
        });

        it('should set child values', () => {
          g.setValue({'one': 'one', 'two': 'two'});
          expect(c.value).toEqual('one');
          expect(c2.value).toEqual('two');
        });

        it('should set parent values', () => {
          const form = new FormGroup({'parent': g});
          g.setValue({'one': 'one', 'two': 'two'});
          expect(form.value).toEqual({'parent': {'one': 'one', 'two': 'two'}});
        });

        it('should throw if fields are missing from supplied value (subset)', () => {
          expect(() => g.setValue({
            'one': 'one'
          })).toThrowError(new RegExp(`Must supply a value for form control with name: 'two'`));
        });

        it('should throw if a value is provided for a missing control (superset)', () => {
          expect(() => g.setValue({'one': 'one', 'two': 'two', 'three': 'three'}))
              .toThrowError(new RegExp(`Cannot find form control with name: three`));
        });

        it('should throw if no controls are set yet', () => {
          const empty = new FormGroup({});
          expect(() => empty.setValue({
            'one': 'one'
          })).toThrowError(new RegExp(`no form controls registered with this group`));
        });

        describe('setValue() events', () => {
          let form: FormGroup;
          let logger: any[];

          beforeEach(() => {
            form = new FormGroup({'parent': g});
            logger = [];
          });

          it('should emit one valueChange event per control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            g.valueChanges.subscribe(() => logger.push('group'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            g.setValue({'one': 'one', 'two': 'two'});
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });

          it('should emit one statusChange event per control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            g.statusChanges.subscribe(() => logger.push('group'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));

            g.setValue({'one': 'one', 'two': 'two'});
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });
        });
      });

      describe('patchValue', () => {
        let c: FormControl, c2: FormControl, g: FormGroup;

        beforeEach(() => {
          c = new FormControl('');
          c2 = new FormControl('');
          g = new FormGroup({'one': c, 'two': c2});
        });

        it('should set its own value', () => {
          g.patchValue({'one': 'one', 'two': 'two'});
          expect(g.value).toEqual({'one': 'one', 'two': 'two'});
        });

        it('should set child values', () => {
          g.patchValue({'one': 'one', 'two': 'two'});
          expect(c.value).toEqual('one');
          expect(c2.value).toEqual('two');
        });

        it('should set parent values', () => {
          const form = new FormGroup({'parent': g});
          g.patchValue({'one': 'one', 'two': 'two'});
          expect(form.value).toEqual({'parent': {'one': 'one', 'two': 'two'}});
        });

        it('should ignore fields that are missing from supplied value (subset)', () => {
          g.patchValue({'one': 'one'});
          expect(g.value).toEqual({'one': 'one', 'two': ''});
        });

        it('should not ignore fields that are null', () => {
          g.patchValue({'one': null});
          expect(g.value).toEqual({'one': null, 'two': ''});
        });

        it('should ignore any value provided for a missing control (superset)', () => {
          g.patchValue({'three': 'three'});
          expect(g.value).toEqual({'one': '', 'two': ''});
        });

        describe('patchValue() events', () => {
          let form: FormGroup;
          let logger: any[];

          beforeEach(() => {
            form = new FormGroup({'parent': g});
            logger = [];
          });

          it('should emit one valueChange event per control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            g.valueChanges.subscribe(() => logger.push('group'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            g.patchValue({'one': 'one', 'two': 'two'});
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });

          it('should not emit valueChange events for skipped controls', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            g.valueChanges.subscribe(() => logger.push('group'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            g.patchValue({'one': 'one'});
            expect(logger).toEqual(['control1', 'group', 'form']);
          });

          it('should emit one statusChange event per control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            g.statusChanges.subscribe(() => logger.push('group'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));

            g.patchValue({'one': 'one', 'two': 'two'});
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });
        });
      });

      describe('reset()', () => {
        let c: FormControl, c2: FormControl, g: FormGroup;

        beforeEach(() => {
          c = new FormControl('initial value');
          c2 = new FormControl('');
          g = new FormGroup({'one': c, 'two': c2});
        });

        it('should set its own value if value passed', () => {
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset({'one': 'initial value', 'two': ''});
          expect(g.value).toEqual({'one': 'initial value', 'two': ''});
        });

        it('should clear its own value if no value passed', () => {
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset();
          expect(g.value).toEqual({'one': null, 'two': null});
        });

        it('should set the value of each of its child controls if value passed', () => {
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset({'one': 'initial value', 'two': ''});
          expect(c.value).toBe('initial value');
          expect(c2.value).toBe('');
        });

        it('should clear the value of each of its child controls if no value passed', () => {
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset();
          expect(c.value).toBe(null);
          expect(c2.value).toBe(null);
        });

        it('should set the value of its parent if value passed', () => {
          const form = new FormGroup({'g': g});
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset({'one': 'initial value', 'two': ''});
          expect(form.value).toEqual({'g': {'one': 'initial value', 'two': ''}});
        });

        it('should clear the value of its parent if no value passed', () => {
          const form = new FormGroup({'g': g});
          g.setValue({'one': 'new value', 'two': 'new value'});

          g.reset();
          expect(form.value).toEqual({'g': {'one': null, 'two': null}});
        });

        it('should mark itself as pristine', () => {
          g.markAsDirty();
          expect(g.pristine).toBe(false);

          g.reset();
          expect(g.pristine).toBe(true);
        });

        it('should mark all child controls as pristine', () => {
          c.markAsDirty();
          c2.markAsDirty();
          expect(c.pristine).toBe(false);
          expect(c2.pristine).toBe(false);

          g.reset();
          expect(c.pristine).toBe(true);
          expect(c2.pristine).toBe(true);
        });

        it('should mark the parent as pristine if all siblings pristine', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'g': g, 'c3': c3});

          g.markAsDirty();
          expect(form.pristine).toBe(false);

          g.reset();
          expect(form.pristine).toBe(true);
        });

        it('should not mark the parent pristine if any dirty siblings', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'g': g, 'c3': c3});

          g.markAsDirty();
          c3.markAsDirty();
          expect(form.pristine).toBe(false);

          g.reset();
          expect(form.pristine).toBe(false);
        });

        it('should mark itself as untouched', () => {
          g.markAsTouched();
          expect(g.untouched).toBe(false);

          g.reset();
          expect(g.untouched).toBe(true);
        });

        it('should mark all child controls as untouched', () => {
          c.markAsTouched();
          c2.markAsTouched();
          expect(c.untouched).toBe(false);
          expect(c2.untouched).toBe(false);

          g.reset();
          expect(c.untouched).toBe(true);
          expect(c2.untouched).toBe(true);
        });

        it('should mark the parent untouched if all siblings untouched', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'g': g, 'c3': c3});

          g.markAsTouched();
          expect(form.untouched).toBe(false);

          g.reset();
          expect(form.untouched).toBe(true);
        });

        it('should not mark the parent untouched if any touched siblings', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'g': g, 'c3': c3});

          g.markAsTouched();
          c3.markAsTouched();
          expect(form.untouched).toBe(false);

          g.reset();
          expect(form.untouched).toBe(false);
        });

        describe('reset() events', () => {
          let form: FormGroup, c3: FormControl, logger: any[];

          beforeEach(() => {
            c3 = new FormControl('');
            form = new FormGroup({'g': g, 'c3': c3});
            logger = [];
          });

          it('should emit one valueChange event per reset control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            g.valueChanges.subscribe(() => logger.push('group'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));
            c3.valueChanges.subscribe(() => logger.push('control3'));

            g.reset();
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });

          it('should emit one statusChange event per reset control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            g.statusChanges.subscribe(() => logger.push('group'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));
            c3.statusChanges.subscribe(() => logger.push('control3'));

            g.reset();
            expect(logger).toEqual(['control1', 'control2', 'group', 'form']);
          });
        });

      });

      describe('optional components', () => {
        describe('contains', () => {
          var group: any /** TODO #9100 */;

          beforeEach(() => {
            group = new FormGroup(
                {
                  'required': new FormControl('requiredValue'),
                  'optional': new FormControl('optionalValue')
                },
                {'optional': false});
          });

          // rename contains into has
          it('should return false when the component is not included',
             () => { expect(group.contains('optional')).toEqual(false); });

          it('should return false when there is no component with the given name',
             () => { expect(group.contains('something else')).toEqual(false); });

          it('should return true when the component is included', () => {
            expect(group.contains('required')).toEqual(true);

            group.include('optional');

            expect(group.contains('optional')).toEqual(true);
          });
        });

        it('should not include an inactive component into the group value', () => {
          var group = new FormGroup(
              {
                'required': new FormControl('requiredValue'),
                'optional': new FormControl('optionalValue')
              },
              {'optional': false});

          expect(group.value).toEqual({'required': 'requiredValue'});

          group.include('optional');

          expect(group.value).toEqual({'required': 'requiredValue', 'optional': 'optionalValue'});
        });

        it('should not run Validators on an inactive component', () => {
          var group = new FormGroup(
              {
                'required': new FormControl('requiredValue', Validators.required),
                'optional': new FormControl('', Validators.required)
              },
              {'optional': false});

          expect(group.valid).toEqual(true);

          group.include('optional');

          expect(group.valid).toEqual(false);
        });
      });

      describe('valueChanges', () => {
        var g: FormGroup, c1: FormControl, c2: FormControl;

        beforeEach(() => {
          c1 = new FormControl('old1');
          c2 = new FormControl('old2');
          g = new FormGroup({'one': c1, 'two': c2}, {'two': true});
        });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             g.valueChanges.subscribe({
               next: (value: any) => {
                 expect(g.value).toEqual({'one': 'new1', 'two': 'old2'});
                 expect(value).toEqual({'one': 'new1', 'two': 'old2'});
                 async.done();
               }
             });
             c1.setValue('new1');
           }));

        it('should fire an event after the control\'s observable fired an event',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var controlCallbackIsCalled = false;


             c1.valueChanges.subscribe({next: (value: any) => { controlCallbackIsCalled = true; }});

             g.valueChanges.subscribe({
               next: (value: any) => {
                 expect(controlCallbackIsCalled).toBe(true);
                 async.done();
               }
             });

             c1.setValue('new1');
           }));

        it('should fire an event when a control is excluded',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             g.valueChanges.subscribe({
               next: (value: any) => {
                 expect(value).toEqual({'one': 'old1'});
                 async.done();
               }
             });

             g.exclude('two');
           }));

        it('should fire an event when a control is included',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             g.exclude('two');

             g.valueChanges.subscribe({
               next: (value: any) => {
                 expect(value).toEqual({'one': 'old1', 'two': 'old2'});
                 async.done();
               }
             });

             g.include('two');
           }));

        it('should fire an event every time a control is updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var loggedValues: any[] /** TODO #9100 */ = [];

             g.valueChanges.subscribe({
               next: (value: any) => {
                 loggedValues.push(value);

                 if (loggedValues.length == 2) {
                   expect(loggedValues).toEqual([
                     {'one': 'new1', 'two': 'old2'}, {'one': 'new1', 'two': 'new2'}
                   ]);
                   async.done();
                 }
               }
             });

             c1.setValue('new1');
             c2.setValue('new2');
           }));

        // hard to test without hacking zones
        // xit('should not fire an event when an excluded control is updated', () => null);
      });

      describe('statusChanges', () => {
        const control = new FormControl('', asyncValidatorReturningObservable);
        const group = new FormGroup({'one': control});

        // TODO(kara): update these tests to use fake Async
        it('should fire a statusChange if child has async validation change',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             const loggedValues: string[] = [];
             group.statusChanges.subscribe({
               next: (status: string) => {
                 loggedValues.push(status);
                 if (loggedValues.length === 2) {
                   expect(loggedValues).toEqual(['PENDING', 'INVALID']);
                 }
                 async.done();
               }
             });
             control.setValue('');
           }));
      });

      describe('getError', () => {
        it('should return the error when it is present', () => {
          var c = new FormControl('', Validators.required);
          var g = new FormGroup({'one': c});
          expect(c.getError('required')).toEqual(true);
          expect(g.getError('required', ['one'])).toEqual(true);
        });

        it('should return null otherwise', () => {
          var c = new FormControl('not empty', Validators.required);
          var g = new FormGroup({'one': c});
          expect(c.getError('invalid')).toEqual(null);
          expect(g.getError('required', ['one'])).toEqual(null);
          expect(g.getError('required', ['invalid'])).toEqual(null);
        });
      });

      describe('asyncValidator', () => {
        it('should run the async validator', fakeAsync(() => {
             var c = new FormControl('value');
             var g = new FormGroup({'one': c}, null, null, asyncValidator('expected'));

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.pending).toEqual(false);
           }));

        it('should set the parent group\'s status to pending', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             var g = new FormGroup({'one': c});

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.pending).toEqual(false);
           }));

        it('should run the parent group\'s async validator when children are pending',
           fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             var g = new FormGroup({'one': c}, null, null, asyncValidator('expected'));

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.get('one').errors).toEqual({'async': true});
           }));
      });
    });

    describe('FormArray', () => {
      describe('adding/removing', () => {
        var a: FormArray;
        var c1: any /** TODO #9100 */, c2: any /** TODO #9100 */, c3: any /** TODO #9100 */;

        beforeEach(() => {
          a = new FormArray([]);
          c1 = new FormControl(1);
          c2 = new FormControl(2);
          c3 = new FormControl(3);
        });

        it('should support pushing', () => {
          a.push(c1);
          expect(a.length).toEqual(1);
          expect(a.controls).toEqual([c1]);
        });

        it('should support removing', () => {
          a.push(c1);
          a.push(c2);
          a.push(c3);

          a.removeAt(1);

          expect(a.controls).toEqual([c1, c3]);
        });

        it('should support inserting', () => {
          a.push(c1);
          a.push(c3);

          a.insert(1, c2);

          expect(a.controls).toEqual([c1, c2, c3]);
        });
      });

      describe('value', () => {
        it('should be the reduced value of the child controls', () => {
          var a = new FormArray([new FormControl(1), new FormControl(2)]);
          expect(a.value).toEqual([1, 2]);
        });

        it('should be an empty array when there are no child controls', () => {
          var a = new FormArray([]);
          expect(a.value).toEqual([]);
        });
      });

      describe('setValue', () => {
        let c: FormControl, c2: FormControl, a: FormArray;

        beforeEach(() => {
          c = new FormControl('');
          c2 = new FormControl('');
          a = new FormArray([c, c2]);
        });

        it('should set its own value', () => {
          a.setValue(['one', 'two']);
          expect(a.value).toEqual(['one', 'two']);
        });

        it('should set child values', () => {
          a.setValue(['one', 'two']);
          expect(c.value).toEqual('one');
          expect(c2.value).toEqual('two');
        });

        it('should set parent values', () => {
          const form = new FormGroup({'parent': a});
          a.setValue(['one', 'two']);
          expect(form.value).toEqual({'parent': ['one', 'two']});
        });

        it('should throw if fields are missing from supplied value (subset)', () => {
          expect(() => a.setValue([, 'two']))
              .toThrowError(new RegExp(`Must supply a value for form control at index: 0`));
        });

        it('should throw if a value is provided for a missing control (superset)', () => {
          expect(() => a.setValue([
            'one', 'two', 'three'
          ])).toThrowError(new RegExp(`Cannot find form control at index 2`));
        });

        it('should throw if no controls are set yet', () => {
          const empty = new FormArray([]);
          expect(() => empty.setValue(['one']))
              .toThrowError(new RegExp(`no form controls registered with this array`));
        });

        describe('setValue() events', () => {
          let form: FormGroup;
          let logger: any[];

          beforeEach(() => {
            form = new FormGroup({'parent': a});
            logger = [];
          });

          it('should emit one valueChange event per control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            a.valueChanges.subscribe(() => logger.push('array'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            a.setValue(['one', 'two']);
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });

          it('should emit one statusChange event per control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            a.statusChanges.subscribe(() => logger.push('array'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));

            a.setValue(['one', 'two']);
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });
        });
      });

      describe('patchValue', () => {
        let c: FormControl, c2: FormControl, a: FormArray;

        beforeEach(() => {
          c = new FormControl('');
          c2 = new FormControl('');
          a = new FormArray([c, c2]);
        });

        it('should set its own value', () => {
          a.patchValue(['one', 'two']);
          expect(a.value).toEqual(['one', 'two']);
        });

        it('should set child values', () => {
          a.patchValue(['one', 'two']);
          expect(c.value).toEqual('one');
          expect(c2.value).toEqual('two');
        });

        it('should set parent values', () => {
          const form = new FormGroup({'parent': a});
          a.patchValue(['one', 'two']);
          expect(form.value).toEqual({'parent': ['one', 'two']});
        });

        it('should ignore fields that are missing from supplied value (subset)', () => {
          a.patchValue([, 'two']);
          expect(a.value).toEqual(['', 'two']);
        });

        it('should not ignore fields that are null', () => {
          a.patchValue([null]);
          expect(a.value).toEqual([null, '']);
        });

        it('should ignore any value provided for a missing control (superset)', () => {
          a.patchValue([, , 'three']);
          expect(a.value).toEqual(['', '']);
        });

        describe('patchValue() events', () => {
          let form: FormGroup;
          let logger: any[];

          beforeEach(() => {
            form = new FormGroup({'parent': a});
            logger = [];
          });

          it('should emit one valueChange event per control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            a.valueChanges.subscribe(() => logger.push('array'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            a.patchValue(['one', 'two']);
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });

          it('should not emit valueChange events for skipped controls', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            a.valueChanges.subscribe(() => logger.push('array'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));

            a.patchValue(['one']);
            expect(logger).toEqual(['control1', 'array', 'form']);
          });

          it('should emit one statusChange event per control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            a.statusChanges.subscribe(() => logger.push('array'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));

            a.patchValue(['one', 'two']);
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });
        });
      });

      describe('reset()', () => {
        let c: FormControl, c2: FormControl, a: FormArray;

        beforeEach(() => {
          c = new FormControl('initial value');
          c2 = new FormControl('');
          a = new FormArray([c, c2]);
        });

        it('should set its own value if value passed', () => {
          a.setValue(['new value', 'new value']);

          a.reset(['initial value', '']);
          expect(a.value).toEqual(['initial value', '']);
        });


        it('should clear its own value if no value passed', () => {
          a.setValue(['new value', 'new value']);

          a.reset();
          expect(a.value).toEqual([null, null]);
        });

        it('should set the value of each of its child controls if value passed', () => {
          a.setValue(['new value', 'new value']);

          a.reset(['initial value', '']);
          expect(c.value).toBe('initial value');
          expect(c2.value).toBe('');
        });

        it('should clear the value of each of its child controls if no value', () => {
          a.setValue(['new value', 'new value']);

          a.reset();
          expect(c.value).toBe(null);
          expect(c2.value).toBe(null);
        });

        it('should set the value of its parent if value passed', () => {
          const form = new FormGroup({'a': a});
          a.setValue(['new value', 'new value']);

          a.reset(['initial value', '']);
          expect(form.value).toEqual({'a': ['initial value', '']});
        });

        it('should clear the value of its parent if no value passed', () => {
          const form = new FormGroup({'a': a});
          a.setValue(['new value', 'new value']);

          a.reset();
          expect(form.value).toEqual({'a': [null, null]});
        });

        it('should mark itself as pristine', () => {
          a.markAsDirty();
          expect(a.pristine).toBe(false);

          a.reset();
          expect(a.pristine).toBe(true);
        });

        it('should mark all child controls as pristine', () => {
          c.markAsDirty();
          c2.markAsDirty();
          expect(c.pristine).toBe(false);
          expect(c2.pristine).toBe(false);

          a.reset();
          expect(c.pristine).toBe(true);
          expect(c2.pristine).toBe(true);
        });

        it('should mark the parent as pristine if all siblings pristine', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'a': a, 'c3': c3});

          a.markAsDirty();
          expect(form.pristine).toBe(false);

          a.reset();
          expect(form.pristine).toBe(true);
        });

        it('should not mark the parent pristine if any dirty siblings', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'a': a, 'c3': c3});

          a.markAsDirty();
          c3.markAsDirty();
          expect(form.pristine).toBe(false);

          a.reset();
          expect(form.pristine).toBe(false);
        });

        it('should mark itself as untouched', () => {
          a.markAsTouched();
          expect(a.untouched).toBe(false);

          a.reset();
          expect(a.untouched).toBe(true);
        });

        it('should mark all child controls as untouched', () => {
          c.markAsTouched();
          c2.markAsTouched();
          expect(c.untouched).toBe(false);
          expect(c2.untouched).toBe(false);

          a.reset();
          expect(c.untouched).toBe(true);
          expect(c2.untouched).toBe(true);
        });

        it('should mark the parent untouched if all siblings untouched', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'a': a, 'c3': c3});

          a.markAsTouched();
          expect(form.untouched).toBe(false);

          a.reset();
          expect(form.untouched).toBe(true);
        });

        it('should not mark the parent untouched if any touched siblings', () => {
          const c3 = new FormControl('');
          const form = new FormGroup({'a': a, 'c3': c3});

          a.markAsTouched();
          c3.markAsTouched();
          expect(form.untouched).toBe(false);

          a.reset();
          expect(form.untouched).toBe(false);
        });

        describe('reset() events', () => {
          let form: FormGroup, c3: FormControl, logger: any[];

          beforeEach(() => {
            c3 = new FormControl('');
            form = new FormGroup({'a': a, 'c3': c3});
            logger = [];
          });

          it('should emit one valueChange event per reset control', () => {
            form.valueChanges.subscribe(() => logger.push('form'));
            a.valueChanges.subscribe(() => logger.push('array'));
            c.valueChanges.subscribe(() => logger.push('control1'));
            c2.valueChanges.subscribe(() => logger.push('control2'));
            c3.valueChanges.subscribe(() => logger.push('control3'));

            a.reset();
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });

          it('should emit one statusChange event per reset control', () => {
            form.statusChanges.subscribe(() => logger.push('form'));
            a.statusChanges.subscribe(() => logger.push('array'));
            c.statusChanges.subscribe(() => logger.push('control1'));
            c2.statusChanges.subscribe(() => logger.push('control2'));
            c3.statusChanges.subscribe(() => logger.push('control3'));

            a.reset();
            expect(logger).toEqual(['control1', 'control2', 'array', 'form']);
          });
        });
      });

      describe('errors', () => {
        it('should run the validator when the value changes', () => {
          var simpleValidator = (c: any /** TODO #9100 */) =>
              c.controls[0].value != 'correct' ? {'broken': true} : null;

          var c = new FormControl(null);
          var g = new FormArray([c], simpleValidator);

          c.setValue('correct');

          expect(g.valid).toEqual(true);
          expect(g.errors).toEqual(null);

          c.setValue('incorrect');

          expect(g.valid).toEqual(false);
          expect(g.errors).toEqual({'broken': true});
        });
      });


      describe('dirty', () => {
        var c: FormControl;
        var a: FormArray;

        beforeEach(() => {
          c = new FormControl('value');
          a = new FormArray([c]);
        });

        it('should be false after creating a control', () => { expect(a.dirty).toEqual(false); });

        it('should be true after changing the value of the control', () => {
          c.markAsDirty();

          expect(a.dirty).toEqual(true);
        });
      });

      describe('touched', () => {
        var c: FormControl;
        var a: FormArray;

        beforeEach(() => {
          c = new FormControl('value');
          a = new FormArray([c]);
        });

        it('should be false after creating a control', () => { expect(a.touched).toEqual(false); });

        it('should be true after child control is marked as touched', () => {
          c.markAsTouched();

          expect(a.touched).toEqual(true);
        });
      });


      describe('pending', () => {
        var c: FormControl;
        var a: FormArray;

        beforeEach(() => {
          c = new FormControl('value');
          a = new FormArray([c]);
        });

        it('should be false after creating a control', () => {
          expect(c.pending).toEqual(false);
          expect(a.pending).toEqual(false);
        });

        it('should be true after changing the value of the control', () => {
          c.markAsPending();

          expect(c.pending).toEqual(true);
          expect(a.pending).toEqual(true);
        });

        it('should not update the parent when onlySelf = true', () => {
          c.markAsPending({onlySelf: true});

          expect(c.pending).toEqual(true);
          expect(a.pending).toEqual(false);
        });
      });

      describe('valueChanges', () => {
        var a: FormArray;
        var c1: any /** TODO #9100 */, c2: any /** TODO #9100 */;

        beforeEach(() => {
          c1 = new FormControl('old1');
          c2 = new FormControl('old2');
          a = new FormArray([c1, c2]);
        });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             a.valueChanges.subscribe({
               next: (value: any) => {
                 expect(a.value).toEqual(['new1', 'old2']);
                 expect(value).toEqual(['new1', 'old2']);
                 async.done();
               }
             });
             c1.setValue('new1');
           }));

        it('should fire an event after the control\'s observable fired an event',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var controlCallbackIsCalled = false;


             c1.valueChanges.subscribe({next: (value: any) => { controlCallbackIsCalled = true; }});

             a.valueChanges.subscribe({
               next: (value: any) => {
                 expect(controlCallbackIsCalled).toBe(true);
                 async.done();
               }
             });

             c1.setValue('new1');
           }));

        it('should fire an event when a control is removed',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             a.valueChanges.subscribe({
               next: (value: any) => {
                 expect(value).toEqual(['old1']);
                 async.done();
               }
             });

             a.removeAt(1);
           }));

        it('should fire an event when a control is added',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             a.removeAt(1);

             a.valueChanges.subscribe({
               next: (value: any) => {
                 expect(value).toEqual(['old1', 'old2']);
                 async.done();
               }
             });

             a.push(c2);
           }));
      });

      describe('get', () => {
        it('should return null when path is null', () => {
          var g = new FormGroup({});
          expect(g.get(null)).toEqual(null);
        });

        it('should return null when path is empty', () => {
          var g = new FormGroup({});
          expect(g.get([])).toEqual(null);
        });

        it('should return null when path is invalid', () => {
          var g = new FormGroup({});
          expect(g.get('invalid')).toEqual(null);
        });

        it('should return a child of a control group', () => {
          var g = new FormGroup({
            'one': new FormControl('111'),
            'nested': new FormGroup({'two': new FormControl('222')})
          });

          expect(g.get(['one']).value).toEqual('111');
          expect(g.get('one').value).toEqual('111');
          expect(g.get(['nested', 'two']).value).toEqual('222');
          expect(g.get('nested.two').value).toEqual('222');
        });

        it('should return an element of an array', () => {
          var g = new FormGroup({'array': new FormArray([new FormControl('111')])});

          expect(g.get(['array', 0]).value).toEqual('111');
        });
      });


      describe('asyncValidator', () => {
        it('should run the async validator', fakeAsync(() => {
             var c = new FormControl('value');
             var g = new FormArray([c], null, asyncValidator('expected'));

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.pending).toEqual(false);
           }));
      });
    });
  });
}
