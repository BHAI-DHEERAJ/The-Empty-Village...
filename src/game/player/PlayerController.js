import { MathUtils, Vector2, Vector3 } from 'three';
import { PLAYER, WORLD } from '../settings.js';
import { CollisionWorld } from '../world/physics/CollisionWorld.js';

export class PlayerController {
  constructor({ spawn = WORLD.spawn, groundY = WORLD.groundY, limit = WORLD.limit, collision, colliders = [] } = {}) {
    this.position = new Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new Vector3();
    this.wish = new Vector2();
    this.collision = collision ?? new CollisionWorld(() => groundY);
    if(!collision) for(const obstacle of colliders) this.collision.addCircle(obstacle.x,obstacle.z,obstacle.radius,obstacle.yMax??Infinity);
    this.grounded = Math.abs(this.collision.supportAt(spawn.x,spawn.z,spawn.y+PLAYER.step)-spawn.y)<.03;
    this.limit = limit;
    this.sprinting = false;
  }

  step(dt, { forward = 0, right = 0, jump = false, sprint = false }, yaw = 0) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    this.wish.set(right*cos-forward*sin, -right*sin-forward*cos).clampLength(0,1);
    const moving=this.wish.lengthSq()>.0001;
    this.sprinting=Boolean(sprint&&moving&&this.grounded&&forward>-.25);
    const speed=this.sprinting?PLAYER.sprintSpeed:PLAYER.speed;
    const ease=moving?PLAYER.acceleration:PLAYER.brake;
    this.velocity.x=MathUtils.damp(this.velocity.x,this.wish.x*speed,ease,dt);
    this.velocity.z=MathUtils.damp(this.velocity.z,this.wish.y*speed,ease,dt);
    const before=this.position.y, oldX=this.position.x, oldZ=this.position.z;
    this.position.x+=this.velocity.x*dt;this.position.z+=this.velocity.z*dt;
    this.#bounds();
    this.collision.resolve(this.position,this.velocity);
    this.#bounds();
    const support=this.collision.supportAt(this.position.x,this.position.z,before+PLAYER.step);
    const expected=this.grounded&&support>=before-PLAYER.step?support:before;
    if(!this.collision.headroomAt(this.position.x,this.position.z,expected)){
      // It is possible to touch the underside of a slab while moving, without
      // actually moving up. Don't let lateral movement shove the head through it.
      this.position.x=oldX;this.position.z=oldZ;
      this.velocity.x=0;this.velocity.z=0;
    }

    if(this.grounded&&jump){this.grounded=false;this.velocity.y=PLAYER.jumpSpeed;}
    if(this.grounded) {
      const support=this.collision.supportAt(this.position.x,this.position.z,before+PLAYER.step);
      if(support>=before-PLAYER.step){this.position.y=support;this.velocity.y=0;return;}
      this.grounded=false;
    }
    this.velocity.y-=PLAYER.gravity*dt;
    this.position.y+=this.velocity.y*dt;
    if(this.velocity.y>0) {
      const cap=this.collision.ceilingAt(this.position.x,this.position.z,before+PLAYER.height,this.position.y+PLAYER.height);
      if(Number.isFinite(cap)){this.position.y=cap-PLAYER.height-.006;this.velocity.y=0;}
    } else {
      const support=this.collision.supportAt(this.position.x,this.position.z,before+.04);
      if(this.position.y<=support){this.position.y=support;this.velocity.y=0;this.grounded=true;}
    }
  }

  #bounds(){
    const allowed=this.limit-PLAYER.radius;
    for(const key of ['x','z']) if(Math.abs(this.position[key])>allowed){this.position[key]=Math.sign(this.position[key])*allowed;this.velocity[key]=0;}
  }
}
