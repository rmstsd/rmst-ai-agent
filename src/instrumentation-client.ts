import { configure, isObservable, toJS } from 'mobx'

configure({ enforceActions: 'never' })

window.__jf = () => ({ isObservable, toJS })
